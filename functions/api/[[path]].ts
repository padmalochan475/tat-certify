import { ZodError } from "zod";
import { ensureDatabaseReady } from "../../src/database";
import {
  academicSessionInputSchema,
  adminLoginSchema,
  branchInputSchema,
  branchContactInputSchema,
  branchContactUpdateSchema,
  companyInputSchema,
  googleLoginSchema,
  durationPolicyInputSchema,
  studentInputSchema,
  templateInputSchema,
  templateUpdateSchema,
  templateV2InputSchema,
  templateV2UpdateSchema,
  applicationInputSchema,
  applicationUpdateSchema,
  certificateGenerateSchema,
  BranchContactInput
} from "../../src/schema";
import { AppError, TatCertificateService } from "../../src/services/certificateService";
import { TemplateService } from "../../src/services/templateService";
import { BranchContactService } from "../../src/services/branchContactService";
import { renderTemplate, buildContext, validateFormData } from "../../src/services/templateEngine";

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  CERTIFICATE_QUEUE: Queue<any>;
  CACHE_KV: KVNamespace;
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

function getGoogleConfig(env: Env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  return {
    enabled: Boolean(clientId),
    clientId,
    hostedDomain: (env.GOOGLE_ALLOWED_HD ?? "tat.ac.in").trim().toLowerCase()
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
  credential: string
): Promise<{ sub: string; username: string }> {
  const googleConfig = getGoogleConfig(env);

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
  const { request } = context;
  const method = request.method.toUpperCase();
  const segments = pathSegments(context.params.path);

  // Priority 0: Identity Engine (No DB needed)
  if (method === "GET" && segments[0] === "google-config") {
    return jsonResponse({ clientId: context.env.GOOGLE_CLIENT_ID });
  }

  // Priority 1: Data Pipeline Verification
  if (!context.env.DB) {
    return jsonResponse({ 
      error: "Infrastructure Configuration Required", 
      message: "Direct D1 Binding 'DB' is missing in your Cloudflare Dashboard for project 'tat-soc'. Please add the binding in Settings > Functions."
    }, 500);
  }

  await ensureDatabaseReady(context.env.DB);

  const service = new TatCertificateService(context.env.DB);

  try {
    if (segments[0] === "student") {
      if (method === "GET" && segments[1] === "bootstrap") {
        return jsonResponse(await service.getStudentBootstrap());
      }

      if (method === "POST" && segments[1] === "requests") {
        const payload = studentInputSchema.parse(await readJson(request));
        return jsonResponse(await service.submitStudentRequest(payload), 201);
      }

      if (method === "POST" && (segments[0] === "student" || segments[0] === "api") && segments[1] === "applications") {
        const payload = applicationInputSchema.parse(await readJson(request));
        
        // 🚨 CRITICAL PRODUCTION VALIDATION: Schema Enforcement
        const templateService = new TemplateService(context.env.DB);
        const template = await templateService.getTemplate(payload.template_id);
        
        if (!template) {
          throw new AppError(404, "Target institutional template not found");
        }
        
        const config = JSON.parse(template.template_json);
        const { valid, errors } = validateFormData(config, payload.form_data);
        
        if (!valid) {
          return jsonResponse({ 
            message: "Application Schema Violation", 
            issues: Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`) 
          }, 400);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await context.env.DB
          .prepare(
            `INSERT INTO applications (id, template_id, student_name, reg_no, branch_id, form_data, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            payload.template_id,
            payload.student_name,
            payload.reg_no,
            payload.branch_id,
            JSON.stringify(payload.form_data),
            "submitted",
            now,
            now
          )
          .run();
        
        await service.writeAuditLog({ email: payload.student_name, method: 'public-form' }, "application.create", "application", id, {
          reg_no: payload.reg_no
        });
        
        return jsonResponse({ id, status: "submitted" }, 201);
      }

      if (method === "GET" && segments[1] === "applications" && segments[2] && segments[3] === "status") {
        // Try applications (V2) first
        let application = await context.env.DB.prepare(
          'SELECT id, status, updated_at FROM applications WHERE id = ?'
        ).bind(segments[2]).first<any>();

        if (!application) {
          // Fallback to legacy students table
          application = await context.env.DB.prepare(
            'SELECT id, status, updated_at FROM students WHERE id = ?'
          ).bind(segments[2]).first<any>();
        }

        if (!application) {
          return jsonResponse({ message: 'Application not found' }, 404);
        }

        // Check for generated certificate if completed
        let certificate = null;
        if (application.status === 'completed' || application.status === 'Approved') {
           certificate = await context.env.DB.prepare(
            'SELECT pdf_url, ref_no FROM certificate_log WHERE application_id = ? OR student_id = ?'
          ).bind(segments[2], segments[2]).first<any>();
        }

        return jsonResponse({
          status: application.status,
          application_id: application.id,
          updated_at: application.updated_at,
          certificate
        });
      }
    }

    // Public Template V2 API
    if (method === "GET" && segments[0] === "templates-v2" && !segments[1]) {
      const templateService = new TemplateService(context.env.DB);
      const type = new URL(request.url).searchParams.get("type") || undefined;
      const activeParam = new URL(request.url).searchParams.get("active");
      const active = activeParam ? activeParam === "true" : undefined;
      const templates = await templateService.listTemplates({ type, active });
      return jsonResponse(templates);
    }

    // Public branch contacts endpoint
    if (method === "GET" && segments[0] === "branch-contacts" && segments[1]) {
      const branchContactService = new BranchContactService(context.env.DB);
      const contacts = await branchContactService.getActiveByBranch(segments[1]);
      return jsonResponse(contacts);
    }

    // Public verification endpoint
    if (method === "GET" && segments[0] === "verify" && segments[1]) {
      const certificate = await context.env.DB.prepare(
        `SELECT cl.*, a.student_name, a.reg_no, a.form_data
         FROM certificate_log cl
         JOIN applications a ON cl.application_id = a.id
         WHERE cl.application_id = ?`
      ).bind(segments[1]).first<any>();

      if (!certificate) {
        return jsonResponse({
          valid: false,
          message: 'Certificate not found'
        }, 404);
      }

      if (certificate.revoked) {
        return jsonResponse({
          valid: false,
          message: 'Certificate has been revoked',
          revoked_at: certificate.revoked_at,
          revoked_reason: certificate.revoked_reason
        }, 200);
      }

      const formData = JSON.parse(certificate.form_data);

      return jsonResponse({
        valid: true,
        certificate: {
          ref_no: certificate.ref_no,
          student_name: certificate.student_name,
          reg_no: certificate.reg_no,
          branch_name: formData.branch_name || 'N/A',
          cert_type: formData.cert_type || 'N/A',
          company_name: formData.company_name || formData.company || 'N/A',
          issue_date: certificate.generated_on,
          academic_year: certificate.academic_year,
          status: 'active'
        }
      });
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
        return jsonResponse(getGoogleConfig(context.env));
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
        const account = await verifyGoogleCredential(context.env, payload.credential);
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
        return jsonResponse(await service.getAdminBootstrap());
      }

      if ((method === "PATCH" || method === "POST") && segments[1] === "students" && segments[3] === "approve") {
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

      if ((method === "PATCH" || method === "POST") && segments[1] === "google-users" && segments[3] === "approve") {
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

      // Branch Contacts CRUD
      const branchContactService = new BranchContactService(context.env.DB);

      if (method === "POST" && segments[1] === "branch-contacts") {
        const payload = branchContactInputSchema.parse(await readJson(request));
        const contact = await branchContactService.create(payload);
        await service.writeAuditLog(actor, "branch_contact.create", "branch_contact", contact.id, {
          branch_id: contact.branch_id,
          contact_name: contact.contact_name
        });
        return jsonResponse(contact, 201);
      }

      if (method === "GET" && segments[1] === "branch-contacts") {
        const branchId = new URL(request.url).searchParams.get('branch_id');
        const contacts = await branchContactService.getAll(branchId || undefined);
        return jsonResponse(contacts);
      }

      if (method === "GET" && segments[1] === "branch-contacts" && segments[2]) {
        const contact = await branchContactService.getById(segments[2]);
        if (!contact) {
          return jsonResponse({ message: 'Branch contact not found' }, 404);
        }
        return jsonResponse(contact);
      }

      if (method === "PUT" && segments[1] === "branch-contacts" && segments[2]) {
        const payload = branchContactUpdateSchema.parse(await readJson(request));
        const contact = await branchContactService.update(segments[2], payload);
        await service.writeAuditLog(actor, "branch_contact.update", "branch_contact", segments[2]);
        return jsonResponse(contact);
      }

      if (method === "DELETE" && segments[1] === "branch-contacts" && segments[2]) {
        await branchContactService.delete(segments[2]);
        await service.writeAuditLog(actor, "branch_contact.delete", "branch_contact", segments[2]);
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

      // ============================================
      // TEMPLATE V2 API ENDPOINTS (JSON-Driven)
      // ============================================

      if (method === "POST" && segments[1] === "templates-v2") {
        const payload = templateV2InputSchema.parse(await readJson(request));
        const templateService = new TemplateService(context.env.DB);
        const template = await templateService.createTemplate(payload, actor.email);
        await service.writeAuditLog(actor, "template_v2.create", "template_v2", template.id, {
          name: template.name
        });
        return jsonResponse(template, 201);
      }

      if (method === "GET" && segments[1] === "templates-v2" && !segments[2]) {
        const templateService = new TemplateService(context.env.DB);
        const type = new URL(request.url).searchParams.get("type") || undefined;
        const activeParam = new URL(request.url).searchParams.get("active");
        const active = activeParam ? activeParam === "true" : undefined;
        const templates = await templateService.listTemplates({ type, active });
        return jsonResponse(templates);
      }

      if (method === "GET" && segments[1] === "templates-v2" && segments[2]) {
        const templateService = new TemplateService(context.env.DB);
        const template = await templateService.getTemplate(segments[2]);
        if (!template) {
          return jsonResponse({ message: "Template not found" }, 404);
        }
        return jsonResponse(template);
      }

      if (method === "PUT" && segments[1] === "templates-v2" && segments[2]) {
        const payload = templateV2UpdateSchema.parse(await readJson(request));
        const templateService = new TemplateService(context.env.DB);
        const template = await templateService.updateTemplate(segments[2], payload, actor.email);
        await service.writeAuditLog(actor, "template_v2.update", "template_v2", template.id, {
          name: template.name
        });
        return jsonResponse(template);
      }

      if (method === "DELETE" && segments[1] === "templates-v2" && segments[2]) {
        const templateService = new TemplateService(context.env.DB);
        await templateService.deleteTemplate(segments[2]);
        await service.writeAuditLog(actor, "template_v2.delete", "template_v2", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "templates-v2" && segments[2] && segments[3] === "clone") {
        const { name } = await readJson(request) as { name: string };
        if (!name) {
          return jsonResponse({ message: "New template name is required" }, 400);
        }
        const templateService = new TemplateService(context.env.DB);
        const cloned = await templateService.cloneTemplate(segments[2], name, actor.email);
        await service.writeAuditLog(actor, "template_v2.clone", "template_v2", cloned.id, {
          original_id: segments[2],
          name: cloned.name
        });
        return jsonResponse(cloned, 201);
      }

      if (method === "POST" && segments[1] === "templates-v2" && segments[2] === "preview-raw") {
        const { template_json, context: previewContext } = await readJson(request) as { template_json: any; context: any };
        const html = renderTemplate(template_json, previewContext);
        return new Response(html, {
          headers: { "Content-Type": "text/html" }
        });
      }

      if (method === "POST" && segments[1] === "templates-v2" && segments[2] && segments[3] === "preview") {
        const { context: previewContext } = await readJson(request) as { context: any };
        const templateService = new TemplateService(context.env.DB);
        const template = await templateService.getTemplate(segments[2]);
        if (!template) {
          return jsonResponse({ message: "Template not found" }, 404);
        }
        const templateJson = templateService.parseTemplateJson(template);
        const html = renderTemplate(templateJson, previewContext);
        return new Response(html, {
          headers: { "Content-Type": "text/html" }
        });
      }

      if (method === "GET" && segments[1] === "templates-v2" && segments[2] && segments[3] === "versions") {
        const templateService = new TemplateService(context.env.DB);
        const versions = await templateService.getTemplateVersions(segments[2]);
        return jsonResponse(versions);
      }

      if (segments[1] === "branch-contacts") {
        const contactService = new BranchContactService(context.env.DB);
        if (method === "GET") {
          const branchId = new URL(request.url).searchParams.get("branch_id") || undefined;
          return jsonResponse(await contactService.getAll(branchId));
        }
        if (method === "POST") {
          const payload = (await readJson(request)) as BranchContactInput;
          const contact = await contactService.create(payload);
          await service.writeAuditLog(actor, "branch_contact.create", "branch_contact", contact.id);
          return jsonResponse(contact, 201);
        }
        if (method === "PUT" && segments[2]) {
          const payload = (await readJson(request)) as Partial<BranchContactInput>;
          const contact = await contactService.update(segments[2], payload);
          await service.writeAuditLog(actor, "branch_contact.update", "branch_contact", contact.id);
          return jsonResponse(contact);
        }
        if (method === "DELETE" && segments[2]) {
          await contactService.delete(segments[2]);
          await service.writeAuditLog(actor, "branch_contact.delete", "branch_contact", segments[2]);
          return noContent();
        }
      }

      // ============================================
      // APPLICATION API ENDPOINTS
      // ============================================

      if (method === "POST" && segments[1] === "applications") {
        const payload = applicationInputSchema.parse(await readJson(request));
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await context.env.DB
          .prepare(
            `INSERT INTO applications (id, template_id, student_name, reg_no, branch_id, form_data, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            payload.template_id,
            payload.student_name,
            payload.reg_no,
            payload.branch_id,
            JSON.stringify(payload.form_data),
            "draft",
            now,
            now
          )
          .run();
        
        await service.writeAuditLog(actor, "application.create", "application", id, {
          student_name: payload.student_name,
          reg_no: payload.reg_no
        });
        
        return jsonResponse({ id, status: "draft" }, 201);
      }

      if (method === "GET" && segments[1] === "applications" && !segments[2]) {
        const status = new URL(request.url).searchParams.get("status") || undefined;
        const branch = new URL(request.url).searchParams.get("branch") || undefined;
        
        let query = `SELECT * FROM applications WHERE 1=1`;
        const bindings: any[] = [];
        
        if (status) {
          query += ` AND status = ?`;
          bindings.push(status);
        }
        
        if (branch) {
          query += ` AND branch_id = ?`;
          bindings.push(branch);
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await context.env.DB.prepare(query).bind(...bindings).all();
        return jsonResponse(result.results);
      }

      if (method === "GET" && segments[1] === "applications" && segments[2]) {
        const result = await context.env.DB
          .prepare(`SELECT * FROM applications WHERE id = ?`)
          .bind(segments[2])
          .first();
        
        if (!result) {
          return jsonResponse({ message: "Application not found" }, 404);
        }
        
        return jsonResponse(result);
      }

      if (method === "PUT" && segments[1] === "applications" && segments[2]) {
        const payload = applicationUpdateSchema.parse(await readJson(request));
        const now = new Date().toISOString();
        
        const updates: string[] = [];
        const bindings: any[] = [];
        
        if (payload.status) {
          updates.push("status = ?");
          bindings.push(payload.status);
          
          if (payload.status === "approved") {
            updates.push("approved_at = ?", "approved_by = ?");
            bindings.push(now, payload.approved_by || actor.email);
          } else if (payload.status === "rejected") {
            updates.push("rejected_at = ?", "rejected_by = ?", "rejection_reason = ?");
            bindings.push(now, payload.rejected_by || actor.email, payload.rejection_reason || "");
          }
        }
        
        updates.push("updated_at = ?");
        bindings.push(now);
        bindings.push(segments[2]);
        
        await context.env.DB
          .prepare(`UPDATE applications SET ${updates.join(", ")} WHERE id = ?`)
          .bind(...bindings)
          .run();
        
        await service.writeAuditLog(actor, "application.update", "application", segments[2], payload);
        
        return jsonResponse({ success: true });
      }

      if (method === "DELETE" && segments[1] === "applications" && segments[2]) {
        await context.env.DB
          .prepare(`DELETE FROM applications WHERE id = ?`)
          .bind(segments[2])
          .run();
        
        await service.writeAuditLog(actor, "application.delete", "application", segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "certificates" && segments[2] === "generate") {
        const json = await readJson(request) as any;
        
        // Handle legacy payload format if sent by old admin.js
        const applicationId = json.application_id || json.studentId;
        const templateId = json.template_id || json.templateId;
        const issueDate = json.issue_date || json.issuedOn || new Date().toISOString().split('T')[0];

        const payload = certificateGenerateSchema.parse({
          application_id: applicationId,
          template_id: templateId,
          issue_date: issueDate
        });
        
        // Validate application exists and is approved (Check both tables)
        let application = await context.env.DB.prepare(
          'SELECT * FROM applications WHERE id = ?'
        ).bind(payload.application_id).first<any>();

        if (!application) {
          // Fallback to legacy students table
          application = await context.env.DB.prepare(
            'SELECT id, "Approved" as status FROM students WHERE id = ?'
          ).bind(payload.application_id).first<any>();
          
          if (application) {
             // For legacy, we might need to "migrate" it or handle it separately
             // But for now, we'll try to use the same flow if we can adapt it
             throw new AppError(400, "Legacy student requests must be migrated to applications first. Or use the legacy generate flow (if it exists).");
          }
        }

        if (!application) {
          return jsonResponse({ message: 'Application not found' }, 404);
        }

        if (application.status.toLowerCase() !== 'approved') {
          return jsonResponse({ message: 'Application must be approved before generating certificate' }, 400);
        }

        // Update status to processing
        await context.env.DB.prepare(
          'UPDATE applications SET status = ?, updated_at = ? WHERE id = ?'
        ).bind('processing', new Date().toISOString(), payload.application_id).run();

        // Push to queue
        await context.env.CERTIFICATE_QUEUE.send({
          application_id: payload.application_id,
          template_id: payload.template_id,
          issue_date: payload.issue_date,
          timestamp: Date.now()
        });

        await service.writeAuditLog(actor, "certificate.generate_queued", "application", payload.application_id, {
          template_id: payload.template_id
        });

        return jsonResponse({
          status: 'processing',
          application_id: payload.application_id,
          message: 'Certificate generation started. Check status for updates.'
        });
      }

      // Get certificate generation status
      if (method === "GET" && segments[1] === "certificates" && segments[2] && segments[3] === "status") {
        const application = await context.env.DB.prepare(
          'SELECT id, status, updated_at FROM applications WHERE id = ?'
        ).bind(segments[2]).first<any>();

        if (!application) {
          return jsonResponse({ message: 'Application not found' }, 404);
        }

        // If completed, get certificate details
        if (application.status === 'completed') {
          const certificate = await context.env.DB.prepare(
            'SELECT * FROM certificate_log WHERE application_id = ?'
          ).bind(segments[2]).first<any>();

          return jsonResponse({
            status: 'completed',
            application_id: application.id,
            certificate: certificate || null
          });
        }

        return jsonResponse({
          status: application.status,
          application_id: application.id,
          updated_at: application.updated_at
        });
      }

      // Regenerate certificate
      if (method === "POST" && segments[1] === "certificates" && segments[2] && segments[3] === "regenerate") {
        const application = await context.env.DB.prepare(
          'SELECT * FROM applications WHERE id = ?'
        ).bind(segments[2]).first<any>();

        if (!application) {
          return jsonResponse({ message: 'Application not found' }, 404);
        }

        // Update status to processing
        await context.env.DB.prepare(
          'UPDATE applications SET status = ?, updated_at = ? WHERE id = ?'
        ).bind('processing', new Date().toISOString(), segments[2]).run();

        // Get template from application
        const template_id = application.template_id;

        // Push to queue
        await context.env.CERTIFICATE_QUEUE.send({
          application_id: segments[2],
          template_id: template_id,
          issue_date: new Date().toISOString().split('T')[0],
          timestamp: Date.now()
        });

        await service.writeAuditLog(actor, "certificate.regenerate_queued", "application", segments[2]);

        return jsonResponse({
          status: 'processing',
          application_id: segments[2],
          message: 'Certificate regeneration started.'
        });
      }

      // Revoke certificate
      if (method === "POST" && segments[1] === "certificates" && segments[2] && segments[3] === "revoke") {
        const payload: any = await readJson(request);
        const reason = payload.reason || 'No reason provided';

        await context.env.DB.prepare(
          `UPDATE certificate_log
           SET revoked = 1, revoked_at = ?, revoked_by = ?, revoked_reason = ?
           WHERE ref_no = ?`
        ).bind(
          new Date().toISOString(),
          actor.email,
          reason,
          segments[2]
        ).run();

        await service.writeAuditLog(actor, "certificate.revoke", "certificate", segments[2], { reason });

        return jsonResponse({ success: true, message: 'Certificate revoked successfully' });
      }

      // System Migration (Internal)
      if (method === "POST" && segments[1] === "system" && segments[2] === "migrate") {
        const result = await service.migrateLegacyStudents(actor.email);
        return jsonResponse(result);
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
    return jsonResponse({ message: "Internal server error", details: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
  }
};
