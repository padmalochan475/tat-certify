import { ZodError } from "zod";
import { ensureDatabaseReady } from "../../src/database";
import {
  academicSessionInputSchema,
  adminLoginSchema,
  branchInputSchema,
  certificateRequestSchema,
  companyInputSchema,
  googleAuthSettingsInputSchema,
  googleLoginSchema,
  durationPolicyInputSchema,
  studentInputSchema,
  templateInputSchema,
  templateUpdateSchema
} from "../../src/schema";
import { AppError, TatCertificateService } from "../../src/services/certificateService";

interface Env {
  DB: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_ALLOWED_HD?: string;
}

const adminCookieName = "tat_admin_session";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const googleJwksUrl = "https://www.googleapis.com/oauth2/v3/certs";

type AdminAuthMethod = "password" | "google";

interface AdminSession {
  sub: string;
  username: string;
  authMethod: AdminAuthMethod;
  issuedAt: number;
}

interface GoogleJwk extends JsonWebKey {
  kid: string;
  alg?: string;
  use?: string;
}

interface GoogleClaims {
  aud: string | string[];
  email?: string;
  email_verified?: boolean | string;
  exp: number;
  hd?: string;
  iss: string;
  name?: string;
  sub: string;
}

let googleJwksCache: { expiresAt: number; keys: GoogleJwk[] } | null = null;

function getAdminSecret(env: Env): string {
  if (!env.ADMIN_SECRET) {
    throw new AppError(500, "Admin secret is not configured");
  }

  return env.ADMIN_SECRET;
}

function getPasswordAdminConfig(env: Env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    throw new AppError(500, "Admin credentials are not configured");
  }

  return {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
    secret: env.ADMIN_SECRET
  };
}

function getGoogleDefaults(env: Env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  return {
    clientId,
    hostedDomain: (env.GOOGLE_ALLOWED_HD ?? "tat.ac.in").trim().toLowerCase(),
    enabled: Boolean(clientId)
  };
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

function noContent(headers: HeadersInit = {}): Response {
  return new Response(null, { status: 204, headers });
}

function parseCookies(cookieHeader = ""): Record<string, string> {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const separatorIndex = chunk.indexOf("=");
        if (separatorIndex === -1) {
          return [chunk, ""];
        }

        return [chunk.slice(0, separatorIndex), decodeURIComponent(chunk.slice(separatorIndex + 1))];
      })
  );
}

function createCookie(name: string, value: string, request: Request, maxAge: number): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];

  if (new URL(request.url).protocol === "https:") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function encodeBase64Url(input: Uint8Array): string {
  let binary = "";

  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeSessionPayload(payload: AdminSession): string {
  return encodeBase64Url(encoder.encode(JSON.stringify(payload)));
}

function decodeSessionPayload(value: string): AdminSession | null {
  try {
    const payload = JSON.parse(decoder.decode(decodeBase64Url(value))) as Partial<AdminSession>;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.issuedAt !== "number" ||
      (payload.authMethod !== "password" && payload.authMethod !== "google")
    ) {
      return null;
    }

    return payload as AdminSession;
  } catch {
    return null;
  }
}

function decodeJwtSegment<T>(segment: string): T {
  return JSON.parse(decoder.decode(decodeBase64Url(segment))) as T;
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}

async function signValue(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createAdminToken(
  env: Env,
  session: Omit<AdminSession, "issuedAt">
): Promise<string> {
  const payload = encodeSessionPayload({
    ...session,
    issuedAt: Date.now()
  });
  const signature = await signValue(getAdminSecret(env), payload);
  return `${payload}.${signature}`;
}

async function readAdminSession(
  env: Env,
  token: string | undefined
): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) {
    return null;
  }

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = await signValue(getAdminSecret(env), payload);

  if (signature !== expectedSignature) {
    return null;
  }

  const session = decodeSessionPayload(payload);
  if (!session) {
    return null;
  }

  if (Date.now() - session.issuedAt > 7 * 24 * 60 * 60 * 1000) {
    return null;
  }

  return session;
}

async function getGoogleJwks(): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (googleJwksCache && googleJwksCache.expiresAt > now) {
    return googleJwksCache.keys;
  }

  const response = await fetch(googleJwksUrl);
  if (!response.ok) {
    throw new AppError(502, "Unable to verify Google login");
  }

  const cacheControl = response.headers.get("Cache-Control") ?? "";
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const body = (await response.json()) as { keys?: GoogleJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];

  if (keys.length === 0) {
    throw new AppError(502, "Google signing keys are unavailable");
  }

  googleJwksCache = {
    expiresAt: now + maxAgeSeconds * 1000,
    keys
  };

  return keys;
}

async function verifyGoogleCredential(
  env: Env,
  service: TatCertificateService,
  credential: string
): Promise<{ sub: string; username: string }> {
  const googleConfig = await service.getGoogleAuthSettings(getGoogleDefaults(env));

  if (!googleConfig.enabled) {
    throw new AppError(400, "Google login is not configured");
  }

  const parts = credential.split(".");
  if (parts.length !== 3) {
    throw new AppError(401, "Invalid Google credential");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeJwtSegment<{ alg?: string; kid?: string }>(headerSegment);

  if (header.alg !== "RS256" || !header.kid) {
    throw new AppError(401, "Unsupported Google credential");
  }

  const keys = await getGoogleJwks();
  const matchingKey = keys.find((entry) => entry.kid === header.kid);

  if (!matchingKey) {
    throw new AppError(401, "Google signing key not found");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    matchingKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    toArrayBuffer(decodeBase64Url(signatureSegment)),
    toArrayBuffer(encoder.encode(`${headerSegment}.${payloadSegment}`))
  );

  if (!signatureValid) {
    throw new AppError(401, "Invalid Google credential signature");
  }

  const claims = decodeJwtSegment<GoogleClaims>(payloadSegment);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const email = claims.email?.trim().toLowerCase() ?? "";
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  const issuerAllowed =
    claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (!audience.includes(googleConfig.clientId)) {
    throw new AppError(401, "Google credential audience mismatch");
  }

  if (!issuerAllowed || claims.exp <= nowInSeconds) {
    throw new AppError(401, "Google credential is expired or invalid");
  }

  if (!email || !emailVerified) {
    throw new AppError(403, "Google account email is not verified");
  }

  if (claims.hd !== googleConfig.hostedDomain || !email.endsWith(`@${googleConfig.hostedDomain}`)) {
    throw new AppError(403, `Only ${googleConfig.hostedDomain} Google Workspace accounts are allowed`);
  }

  return {
    sub: claims.sub,
    username: email
  };
}

async function getAuthenticatedAdmin(
  context: EventContext<Env, string, unknown>
): Promise<AdminSession> {
  const cookies = parseCookies(context.request.headers.get("Cookie") ?? "");
  const session = await readAdminSession(context.env, cookies[adminCookieName]);

  if (!session) {
    throw new AppError(401, "Admin login required");
  }

  return session;
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function pathSegments(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

export const onRequest: PagesFunction<Env> = async (context) => {
  await ensureDatabaseReady(context.env.DB);

  const service = new TatCertificateService(context.env.DB);
  const { request } = context;
  const method = request.method.toUpperCase();
  const segments = pathSegments(context.params.path);

  try {
    if (segments[0] === "student") {
      if (method === "GET" && segments[1] === "bootstrap") {
        return jsonResponse(await service.getStudentBootstrap());
      }

      if (method === "POST" && segments[1] === "requests") {
        const payload = studentInputSchema.parse(await readJson(request));
        return jsonResponse(await service.submitStudentRequest(payload), 201);
      }
    }

    if (segments[0] === "admin") {
      if (method === "GET" && segments[1] === "session") {
        const cookies = parseCookies(request.headers.get("Cookie") ?? "");
        const session = await readAdminSession(context.env, cookies[adminCookieName]);
        return jsonResponse({
          authenticated: Boolean(session),
          username: session?.username ?? null
        });
      }

      if (method === "GET" && segments[1] === "google" && segments[2] === "config") {
        return jsonResponse(await service.getGoogleAuthSettings(getGoogleDefaults(context.env)));
      }

      if (method === "POST" && segments[1] === "login") {
        const payload = adminLoginSchema.parse(await readJson(request));
        const { username, password } = getPasswordAdminConfig(context.env);

        if (payload.username !== username || payload.password !== password) {
          throw new AppError(401, "Invalid admin credentials");
        }

        const token = await createAdminToken(context.env, {
          sub: username,
          username,
          authMethod: "password"
        });
        await service.writeAuditLog(
          { email: username, method: "password" },
          "auth.login.password",
          "admin_session",
          username
        );
        return jsonResponse(
          { authenticated: true, username },
          200,
          {
            "Set-Cookie": createCookie(
              adminCookieName,
              token,
              request,
              7 * 24 * 60 * 60
            )
          }
        );
      }

      if (method === "POST" && segments[1] === "google-login") {
        const payload = googleLoginSchema.parse(await readJson(request));
        const account = await verifyGoogleCredential(context.env, service, payload.credential);
        const adminUser = await service.requestGoogleAdminAccess(account.username, account.sub);

        if (adminUser.status !== "Approved") {
          await service.writeAuditLog(
            { email: account.username, method: "google" },
            "auth.google.request",
            "admin_user",
            adminUser.id,
            { status: adminUser.status }
          );
          throw new AppError(403, "Google sign-in request is awaiting admin approval");
        }

        await service.markAdminUserLogin(account.username);
        const token = await createAdminToken(context.env, {
          sub: account.sub,
          username: account.username,
          authMethod: "google"
        });
        await service.writeAuditLog(
          { email: account.username, method: "google" },
          "auth.login.google",
          "admin_user",
          adminUser.id
        );

        return jsonResponse(
          {
            authenticated: true,
            username: account.username
          },
          200,
          {
            "Set-Cookie": createCookie(
              adminCookieName,
              token,
              request,
              7 * 24 * 60 * 60
            )
          }
        );
      }

      if (method === "POST" && segments[1] === "logout") {
        return jsonResponse(
          { authenticated: false },
          200,
          { "Set-Cookie": createCookie(adminCookieName, "", request, 0) }
        );
      }

      const adminSession = await getAuthenticatedAdmin(context);
      const actor = {
        email: adminSession.username,
        method: adminSession.authMethod
      };

      if (method === "GET" && segments[1] === "bootstrap") {
        return jsonResponse(await service.getAdminBootstrap(getGoogleDefaults(context.env)));
      }

      if (method === "POST" && segments[1] === "google" && segments[2] === "settings") {
        const payload = googleAuthSettingsInputSchema.parse(await readJson(request));
        const googleConfig = await service.saveGoogleAuthSettings(
          payload,
          getGoogleDefaults(context.env)
        );
        await service.writeAuditLog(actor, "google.settings.save", "system_state", "google_signin", {
          enabled: googleConfig.enabled,
          hostedDomain: googleConfig.hostedDomain,
          hasClientId: Boolean(googleConfig.clientId)
        });
        return jsonResponse(googleConfig);
      }

      if (method === "PATCH" && segments[1] === "students" && segments[3] === "approve") {
        const student = await service.approveStudent(segments[2] ?? "");
        await service.writeAuditLog(actor, "student.approve", "student", student.id, {
          regNo: student.reg_no
        });
        return jsonResponse(student);
      }

      if (method === "DELETE" && segments[1] === "students" && segments[2]) {
        await service.rejectStudent(segments[2]);
        await service.writeAuditLog(actor, "student.reject", "student", segments[2]);
        return noContent();
      }

      if (method === "PATCH" && segments[1] === "google-users" && segments[3] === "approve") {
        const user = await service.approveAdminUser(segments[2] ?? "", actor.email);
        await service.writeAuditLog(actor, "admin_user.approve", "admin_user", user.id, {
          email: user.email
        });
        return jsonResponse(user);
      }

      if (method === "DELETE" && segments[1] === "google-users" && segments[2]) {
        await service.deleteAdminUser(segments[2]);
        await service.writeAuditLog(actor, "admin_user.remove", "admin_user", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "branches") {
        const payload = branchInputSchema.parse(await readJson(request));
        const branch = await service.saveBranch(payload);
        await service.writeAuditLog(actor, "branch.save", "branch", branch.code);
        return jsonResponse(branch, 201);
      }

      if (method === "DELETE" && segments[1] === "branches" && segments[2]) {
        await service.deleteBranch(segments[2]);
        await service.writeAuditLog(actor, "branch.delete", "branch", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "companies") {
        const payload = companyInputSchema.parse(await readJson(request));
        const company = await service.saveCompany(payload);
        await service.writeAuditLog(actor, "company.save", "company", company.name);
        return jsonResponse(company, 201);
      }

      if (method === "DELETE" && segments[1] === "companies" && segments[2]) {
        await service.deleteCompany(segments[2]);
        await service.writeAuditLog(actor, "company.delete", "company", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "sessions") {
        const payload = academicSessionInputSchema.parse(await readJson(request));
        const sessionRecord = await service.saveAcademicSession(payload);
        await service.writeAuditLog(actor, "session.save", "academic_session", sessionRecord.value);
        return jsonResponse(sessionRecord, 201);
      }

      if (method === "DELETE" && segments[1] === "sessions" && segments[2]) {
        await service.deleteAcademicSession(segments[2]);
        await service.writeAuditLog(actor, "session.delete", "academic_session", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "durations") {
        const payload = durationPolicyInputSchema.parse(await readJson(request));
        const duration = await service.saveDurationPolicy(payload);
        await service.writeAuditLog(actor, "duration.save", "duration_policy", duration.id, {
          label: duration.label
        });
        return jsonResponse(duration, 201);
      }

      if (method === "DELETE" && segments[1] === "durations" && segments[2]) {
        await service.deleteDurationPolicy(segments[2]);
        await service.writeAuditLog(actor, "duration.delete", "duration_policy", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "templates") {
        const payload = templateInputSchema.parse(await readJson(request));
        const template = await service.createTemplate(payload);
        await service.writeAuditLog(actor, "template.create", "template", template.id, {
          name: template.name
        });
        return jsonResponse(template, 201);
      }

      if (method === "PATCH" && segments[1] === "templates" && segments[2]) {
        const payload = templateUpdateSchema.parse(await readJson(request));
        const template = await service.updateTemplate(segments[2], payload);
        await service.writeAuditLog(actor, "template.update", "template", template.id, {
          name: template.name
        });
        return jsonResponse(template);
      }

      if (method === "DELETE" && segments[1] === "templates" && segments[2]) {
        await service.deleteTemplate(segments[2]);
        await service.writeAuditLog(actor, "template.delete", "template", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "certificates" && segments[2] === "generate") {
        const payload = certificateRequestSchema.parse(await readJson(request));
        const certificate = await service.generateCertificate(
          payload.studentId,
          payload.templateId,
          payload.issuedOn
        );
        await service.writeAuditLog(actor, "certificate.generate", "student", payload.studentId, {
          refNo: certificate.refNo,
          templateId: payload.templateId
        });
        return jsonResponse(certificate);
      }
    }

    return jsonResponse({ message: "Not found" }, 404);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(
        {
          message: "Validation failed",
          issues: error.issues.map((issue) => issue.message)
        },
        400
      );
    }

    if (error instanceof AppError) {
      return jsonResponse({ message: error.message }, error.statusCode);
    }

    console.error(error);
    return jsonResponse({ message: "Internal server error" }, 500);
  }
};
