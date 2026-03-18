import { ZodError } from "zod";
import { ensureDatabaseReady } from "../../src/database";
import {
  academicSessionInputSchema,
  adminLoginSchema,
  branchInputSchema,
  certificateRequestSchema,
  companyInputSchema,
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
}

const adminCookieName = "tat_admin_session";
const encoder = new TextEncoder();

function getAdminConfig(env: Env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    throw new AppError(500, "Admin credentials are not configured");
  }

  return {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
    secret: env.ADMIN_SECRET
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

async function createAdminToken(env: Env): Promise<string> {
  const { username, secret } = getAdminConfig(env);
  const issuedAt = Date.now();
  const payload = `${username}:${issuedAt}`;
  const signature = await signValue(secret, payload);
  return `${payload}:${signature}`;
}

async function isValidAdminToken(env: Env, token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const { username, secret } = getAdminConfig(env);
  const parts = token.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [tokenUsername, issuedAtText, signature] = parts;
  if (tokenUsername !== username) {
    return false;
  }

  const issuedAt = Number(issuedAtText);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  if (Date.now() - issuedAt > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const expectedSignature = await signValue(secret, `${tokenUsername}:${issuedAtText}`);
  return signature === expectedSignature;
}

async function requireAdmin(context: EventContext<Env, string, unknown>): Promise<Response | null> {
  const cookies = parseCookies(context.request.headers.get("Cookie") ?? "");
  if (!(await isValidAdminToken(context.env, cookies[adminCookieName]))) {
    return jsonResponse({ message: "Admin login required" }, 401);
  }

  return null;
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
        const { username } = getAdminConfig(context.env);
        return jsonResponse({
          authenticated: await isValidAdminToken(context.env, cookies[adminCookieName]),
          username
        });
      }

      if (method === "POST" && segments[1] === "login") {
        const payload = adminLoginSchema.parse(await readJson(request));
        const { username, password } = getAdminConfig(context.env);

        if (payload.username !== username || payload.password !== password) {
          throw new AppError(401, "Invalid admin credentials");
        }

        const token = await createAdminToken(context.env);
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

      if (method === "POST" && segments[1] === "logout") {
        return jsonResponse(
          { authenticated: false },
          200,
          { "Set-Cookie": createCookie(adminCookieName, "", request, 0) }
        );
      }

      const unauthorized = await requireAdmin(context);
      if (unauthorized) {
        return unauthorized;
      }

      if (method === "GET" && segments[1] === "bootstrap") {
        return jsonResponse(await service.getAdminBootstrap());
      }

      if (method === "PATCH" && segments[1] === "students" && segments[3] === "approve") {
        return jsonResponse(await service.approveStudent(segments[2] ?? ""));
      }

      if (method === "DELETE" && segments[1] === "students" && segments[2]) {
        await service.rejectStudent(segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "branches") {
        const payload = branchInputSchema.parse(await readJson(request));
        return jsonResponse(await service.saveBranch(payload), 201);
      }

      if (method === "DELETE" && segments[1] === "branches" && segments[2]) {
        await service.deleteBranch(segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "companies") {
        const payload = companyInputSchema.parse(await readJson(request));
        return jsonResponse(await service.saveCompany(payload), 201);
      }

      if (method === "DELETE" && segments[1] === "companies" && segments[2]) {
        await service.deleteCompany(segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "sessions") {
        const payload = academicSessionInputSchema.parse(await readJson(request));
        return jsonResponse(await service.saveAcademicSession(payload), 201);
      }

      if (method === "DELETE" && segments[1] === "sessions" && segments[2]) {
        await service.deleteAcademicSession(segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "durations") {
        const payload = durationPolicyInputSchema.parse(await readJson(request));
        return jsonResponse(await service.saveDurationPolicy(payload), 201);
      }

      if (method === "DELETE" && segments[1] === "durations" && segments[2]) {
        await service.deleteDurationPolicy(segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "templates") {
        const payload = templateInputSchema.parse(await readJson(request));
        return jsonResponse(await service.createTemplate(payload), 201);
      }

      if (method === "PATCH" && segments[1] === "templates" && segments[2]) {
        const payload = templateUpdateSchema.parse(await readJson(request));
        return jsonResponse(await service.updateTemplate(segments[2], payload));
      }

      if (method === "DELETE" && segments[1] === "templates" && segments[2]) {
        await service.deleteTemplate(segments[2]);
        return noContent();
      }

      if (method === "POST" && segments[1] === "certificates" && segments[2] === "generate") {
        const payload = certificateRequestSchema.parse(await readJson(request));
        return jsonResponse(
          await service.generateCertificate(payload.studentId, payload.templateId, payload.issuedOn)
        );
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
