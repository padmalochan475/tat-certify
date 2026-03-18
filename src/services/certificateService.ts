import { getAcademicYear } from "../engines/academicYear";
import { applyTemplate } from "../engines/template";
import type {
  AcademicSessionInput,
  AcademicSessionRecord,
  AdminUserRecord,
  AuditLogRecord,
  BranchInput,
  BranchRecord,
  CompanyInput,
  CompanyRecord,
  DurationPolicyInput,
  DurationPolicyRecord,
  GoogleAuthSettings,
  GoogleAuthSettingsInput,
  StudentInput,
  StudentRecord,
  TemplateInput,
  TemplateRecord
} from "../schema";
import { CrudEngine } from "./crud";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export interface StudentBootstrapPayload {
  branches: BranchRecord[];
  companies: CompanyRecord[];
  sessions: AcademicSessionRecord[];
  durations: DurationPolicyRecord[];
}

export interface AdminBootstrapPayload extends StudentBootstrapPayload {
  adminUsers: AdminUserRecord[];
  auditLog: AuditLogRecord[];
  googleConfig: GoogleAuthSettings;
  students: StudentRecord[];
  templates: TemplateRecord[];
  certificateLog: Array<{
    ref_no: string;
    generated_on: string;
    academic_year: string;
    student_name: string;
    reg_no: string;
    cert_type: string;
    template_name: string;
  }>;
}

export interface AdminActor {
  email: string;
  method: string;
}

type RowRecord = Record<string, unknown>;

function normalizeTemplate(record: RowRecord): TemplateRecord {
  return {
    id: String(record.id),
    name: String(record.name),
    type: String(record.type) as TemplateRecord["type"],
    content: String(record.content),
    active: Boolean(record.active)
  };
}

function normalizeBranch(record: RowRecord): BranchRecord {
  return {
    code: String(record.code),
    name: String(record.name),
    hod_name: String(record.hod_name),
    hod_email: String(record.hod_email),
    hod_mobile: String(record.hod_mobile),
    current_serial: Number(record.current_serial),
    serial_year: Number(record.serial_year)
  };
}

function normalizeCompany(record: RowRecord): CompanyRecord {
  return {
    name: String(record.name),
    hr_title: String(record.hr_title),
    address: String(record.address)
  };
}

function normalizeAcademicSession(record: RowRecord): AcademicSessionRecord {
  return {
    value: String(record.value),
    active: Boolean(record.active)
  };
}

function normalizeDurationPolicy(record: RowRecord): DurationPolicyRecord {
  return {
    id: String(record.id),
    cert_type: String(record.cert_type) as DurationPolicyRecord["cert_type"],
    label: String(record.label),
    active: Boolean(record.active)
  };
}

function normalizeStudent(record: RowRecord): StudentRecord {
  return {
    id: String(record.id),
    full_name: String(record.full_name),
    reg_no: String(record.reg_no),
    branch: String(record.branch),
    year: String(record.year),
    session: String(record.session),
    cert_type: String(record.cert_type) as StudentRecord["cert_type"],
    company: String(record.company),
    company_hr_title: String(record.company_hr_title),
    company_address: String(record.company_address),
    duration: String(record.duration),
    start_date: String(record.start_date),
    status: String(record.status) as StudentRecord["status"],
    created_at: String(record.created_at)
  };
}

function normalizeAdminUser(record: RowRecord): AdminUserRecord {
  return {
    id: String(record.id),
    email: String(record.email),
    auth_provider: "Google",
    status: String(record.status) as AdminUserRecord["status"],
    google_sub: String(record.google_sub),
    created_at: String(record.created_at),
    approved_at: record.approved_at ? String(record.approved_at) : null,
    approved_by: record.approved_by ? String(record.approved_by) : null,
    last_login_at: record.last_login_at ? String(record.last_login_at) : null
  };
}

function normalizeAuditLog(record: RowRecord): AuditLogRecord {
  return {
    id: String(record.id),
    actor_email: String(record.actor_email),
    actor_method: String(record.actor_method),
    action: String(record.action),
    target_type: String(record.target_type),
    target_id: String(record.target_id),
    details: record.details ? String(record.details) : null,
    created_at: String(record.created_at)
  };
}

function normalizeHostedDomain(value: string): string {
  return value.trim().toLowerCase();
}

function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatLongDate(dateInput: string): string {
  const date = new Date(`${dateInput}T00:00:00`);
  return `${ordinal(date.getDate())} ${date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  })}`;
}

function buildReference(branchCode: string, serial: number, year: number): string {
  return `TAT/${branchCode}/${serial}/${year}`;
}

async function runQuery<T extends RowRecord>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const statement = db.prepare(sql);
  const prepared = params.length > 0 ? statement.bind(...params) : statement;
  const result = await prepared.run<T>();
  return result.results;
}

async function firstQuery<T extends RowRecord>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const statement = db.prepare(sql);
  const prepared = params.length > 0 ? statement.bind(...params) : statement;
  return ((await prepared.first<T>()) as T | null) ?? null;
}

export class TatCertificateService {
  private readonly crud: CrudEngine;

  constructor(private readonly db: D1Database) {
    this.crud = new CrudEngine(db);
  }

  async getStudentBootstrap(): Promise<StudentBootstrapPayload> {
    const [branchesResult, companiesResult, sessionsResult, durationsResult] = await this.db.batch([
      this.db.prepare(`SELECT * FROM branches ORDER BY code ASC`),
      this.db.prepare(`SELECT * FROM companies ORDER BY name ASC`),
      this.db.prepare(`SELECT * FROM academic_sessions WHERE active = 1 ORDER BY value DESC`),
      this.db.prepare(
        `SELECT * FROM duration_policies WHERE active = 1 ORDER BY cert_type ASC, label ASC`
      )
    ]);

    return {
      branches: branchesResult.results.map((record) => normalizeBranch(record as RowRecord)),
      companies: companiesResult.results.map((record) => normalizeCompany(record as RowRecord)),
      sessions: sessionsResult.results.map((record) => normalizeAcademicSession(record as RowRecord)),
      durations: durationsResult.results.map((record) => normalizeDurationPolicy(record as RowRecord))
    };
  }

  async getGoogleAuthSettings(
    defaults: Partial<GoogleAuthSettings> = {}
  ): Promise<GoogleAuthSettings> {
    const records = await runQuery<{ key: string; value: string }>(
      this.db,
      `SELECT key, value FROM system_state
       WHERE key IN (?, ?, ?)`,
      ["google_signin_enabled", "google_client_id", "google_allowed_hd"]
    );
    const settings = new Map(records.map((record) => [record.key, record.value]));
    const clientId = (settings.get("google_client_id") ?? defaults.clientId ?? "").trim();
    const hostedDomain = normalizeHostedDomain(
      settings.get("google_allowed_hd") ?? defaults.hostedDomain ?? "tat.ac.in"
    );
    const enabledSetting = settings.get("google_signin_enabled");
    const enabledBySetting =
      enabledSetting === undefined ? defaults.enabled ?? Boolean(clientId) : enabledSetting === "1";

    return {
      enabled: Boolean(clientId) && enabledBySetting,
      clientId,
      hostedDomain
    };
  }

  async saveGoogleAuthSettings(
    input: GoogleAuthSettingsInput,
    defaults: Partial<GoogleAuthSettings> = {}
  ): Promise<GoogleAuthSettings> {
    const clientId = input.client_id.trim();
    const hostedDomain = normalizeHostedDomain(input.allowed_domain || defaults.hostedDomain || "tat.ac.in");
    const enabled = input.enabled && Boolean(clientId);
    const updatedAt = new Date().toISOString();

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO system_state (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        )
        .bind("google_client_id", clientId, updatedAt),
      this.db
        .prepare(
          `INSERT INTO system_state (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        )
        .bind("google_allowed_hd", hostedDomain, updatedAt),
      this.db
        .prepare(
          `INSERT INTO system_state (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        )
        .bind("google_signin_enabled", enabled ? "1" : "0", updatedAt)
    ]);

    return this.getGoogleAuthSettings(defaults);
  }

  async getAdminBootstrap(
    googleDefaults: Partial<GoogleAuthSettings> = {}
  ): Promise<AdminBootstrapPayload> {
    const googleConfigPromise = this.getGoogleAuthSettings(googleDefaults);
    const [
      adminUsersResult,
      auditLogResult,
      studentsResult,
      branchesResult,
      companiesResult,
      sessionsResult,
      durationsResult,
      templatesResult,
      certificateLogResult
    ] = await this.db.batch([
      this.db.prepare(
        `SELECT * FROM admin_users
         ORDER BY CASE status WHEN 'Pending' THEN 0 ELSE 1 END, datetime(created_at) DESC`
      ),
      this.db.prepare(`SELECT * FROM audit_log ORDER BY datetime(created_at) DESC LIMIT 100`),
      this.db.prepare(`SELECT * FROM students ORDER BY datetime(created_at) DESC`),
      this.db.prepare(`SELECT * FROM branches ORDER BY code ASC`),
      this.db.prepare(`SELECT * FROM companies ORDER BY name ASC`),
      this.db.prepare(`SELECT * FROM academic_sessions ORDER BY value DESC`),
      this.db.prepare(`SELECT * FROM duration_policies ORDER BY cert_type ASC, label ASC`),
      this.db.prepare(`SELECT * FROM templates ORDER BY active DESC, name ASC`),
      this.db.prepare(
        `SELECT l.ref_no,
                l.generated_on,
                l.academic_year,
                s.full_name AS student_name,
                s.reg_no,
                s.cert_type,
                t.name AS template_name
         FROM certificate_log l
         JOIN students s ON s.id = l.student_id
         JOIN templates t ON t.id = l.template_id
         ORDER BY datetime(l.generated_on) DESC`
      )
    ]);
    const googleConfig = await googleConfigPromise;

    return {
      adminUsers: adminUsersResult.results.map((record) => normalizeAdminUser(record as RowRecord)),
      auditLog: auditLogResult.results.map((record) => normalizeAuditLog(record as RowRecord)),
      googleConfig,
      students: studentsResult.results.map((record) => normalizeStudent(record as RowRecord)),
      branches: branchesResult.results.map((record) => normalizeBranch(record as RowRecord)),
      companies: companiesResult.results.map((record) => normalizeCompany(record as RowRecord)),
      sessions: sessionsResult.results.map((record) => normalizeAcademicSession(record as RowRecord)),
      durations: durationsResult.results.map((record) => normalizeDurationPolicy(record as RowRecord)),
      templates: templatesResult.results.map((record) => normalizeTemplate(record as RowRecord)),
      certificateLog: certificateLogResult.results as AdminBootstrapPayload["certificateLog"]
    };
  }

  async submitStudentRequest(input: StudentInput): Promise<StudentRecord> {
    const branchCode = input.branch.trim().toUpperCase();
    const sessionValue = input.session.trim();
    const companyName = input.company.trim();
    const companyRecord = await this.findCompany(companyName);

    await this.getBranch(branchCode);
    await this.getAcademicSession(sessionValue, true);
    await this.getDurationPolicy(input.cert_type, input.duration.trim(), true);

    const record: StudentRecord = {
      id: crypto.randomUUID(),
      full_name: input.full_name.trim(),
      reg_no: input.reg_no.trim(),
      branch: branchCode,
      year: input.year.trim(),
      session: sessionValue,
      cert_type: input.cert_type,
      company: companyName,
      company_hr_title: input.company_hr_title.trim() || companyRecord?.hr_title || "",
      company_address: input.company_address.trim() || companyRecord?.address || "",
      duration: input.duration.trim(),
      start_date: input.start_date,
      status: "Pending",
      created_at: new Date().toISOString()
    };

    if (!record.company_hr_title || !record.company_address) {
      throw new AppError(400, "Company HR title and address are required");
    }

    await this.crud.create("students", { ...record });
    return record;
  }

  async approveStudent(studentId: string): Promise<StudentRecord> {
    const student = await this.getStudent(studentId);
    await this.upsertCompanyFromStudent(student);
    await this.crud.update("students", studentId, { status: "Approved" });
    return this.getStudent(studentId);
  }

  async rejectStudent(studentId: string): Promise<void> {
    await this.getStudent(studentId);
    await this.crud.delete("students", studentId);
  }

  async saveBranch(input: BranchInput): Promise<BranchRecord> {
    const code = input.code.trim().toUpperCase();
    const existing = await this.findBranch(code);
    const branch: BranchRecord = {
      code,
      name: input.name.trim(),
      hod_name: input.hod_name.trim(),
      hod_email: input.hod_email.trim(),
      hod_mobile: input.hod_mobile.trim(),
      current_serial: input.current_serial ?? existing?.current_serial ?? 0,
      serial_year: input.serial_year ?? existing?.serial_year ?? new Date().getFullYear()
    };

    await this.db
      .prepare(
        `INSERT INTO branches
         (code, name, hod_name, hod_email, hod_mobile, current_serial, serial_year)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           name = excluded.name,
           hod_name = excluded.hod_name,
           hod_email = excluded.hod_email,
           hod_mobile = excluded.hod_mobile,
           current_serial = excluded.current_serial,
           serial_year = excluded.serial_year`
      )
      .bind(
        branch.code,
        branch.name,
        branch.hod_name,
        branch.hod_email,
        branch.hod_mobile,
        branch.current_serial,
        branch.serial_year
      )
      .run();

    return this.getBranch(branch.code);
  }

  async deleteBranch(code: string): Promise<void> {
    const branchCode = code.trim().toUpperCase();
    await this.getBranch(branchCode);
    await this.crud.delete("branches", branchCode);
  }

  async saveCompany(input: CompanyInput): Promise<CompanyRecord> {
    const company: CompanyRecord = {
      name: input.name.trim(),
      hr_title: input.hr_title.trim(),
      address: input.address.trim()
    };

    await this.db
      .prepare(
        `INSERT INTO companies (name, hr_title, address)
         VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           hr_title = excluded.hr_title,
           address = excluded.address`
      )
      .bind(company.name, company.hr_title, company.address)
      .run();

    return this.getCompany(company.name);
  }

  async deleteCompany(name: string): Promise<void> {
    await this.getCompany(name);
    await this.crud.delete("companies", name);
  }

  async saveAcademicSession(input: AcademicSessionInput): Promise<AcademicSessionRecord> {
    const session = {
      value: input.value.trim(),
      active: input.active ? 1 : 0
    };

    await this.db
      .prepare(
        `INSERT INTO academic_sessions (value, active)
         VALUES (?, ?)
         ON CONFLICT(value) DO UPDATE SET
           active = excluded.active`
      )
      .bind(session.value, session.active)
      .run();

    return this.getAcademicSession(session.value, false);
  }

  async saveDurationPolicy(input: DurationPolicyInput): Promise<DurationPolicyRecord> {
    const label = input.label.trim();
    const existing = await this.findDurationPolicy(input.cert_type, label);
    const record = {
      id: existing?.id ?? crypto.randomUUID(),
      cert_type: input.cert_type,
      label,
      active: input.active ? 1 : 0
    };

    await this.db
      .prepare(
        `INSERT INTO duration_policies (id, cert_type, label, active)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           cert_type = excluded.cert_type,
           label = excluded.label,
           active = excluded.active`
      )
      .bind(record.id, record.cert_type, record.label, record.active)
      .run();

    return this.getDurationPolicy(record.cert_type, record.label, false);
  }

  async deleteDurationPolicy(id: string): Promise<void> {
    const policy = await this.getDurationPolicyById(id);
    const inUse = await firstQuery(
      this.db,
      `SELECT 1 AS used FROM students WHERE cert_type = ? AND duration = ? LIMIT 1`,
      [policy.cert_type, policy.label]
    );

    if (inUse) {
      throw new AppError(400, "Cannot delete a duration option already used by student requests");
    }

    await this.crud.delete("duration_policies", id);
  }

  async deleteAcademicSession(value: string): Promise<void> {
    const session = await this.getAcademicSession(value, false);
    const hasStudents = await firstQuery(
      this.db,
      `SELECT 1 AS used FROM students WHERE session = ? LIMIT 1`,
      [session.value]
    );

    if (hasStudents) {
      throw new AppError(400, "Cannot delete an academic session already used by student requests");
    }

    await this.crud.delete("academic_sessions", session.value);
  }

  async requestGoogleAdminAccess(email: string, googleSub: string): Promise<AdminUserRecord> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await firstQuery(
      this.db,
      `SELECT * FROM admin_users WHERE email = ? OR google_sub = ? LIMIT 1`,
      [normalizedEmail, googleSub]
    );

    if (existing) {
      return normalizeAdminUser(existing);
    }

    const record: AdminUserRecord = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      auth_provider: "Google",
      status: "Pending",
      google_sub: googleSub,
      created_at: new Date().toISOString(),
      approved_at: null,
      approved_by: null,
      last_login_at: null
    };

    await this.crud.create("admin_users", { ...record });
    return record;
  }

  async approveAdminUser(userId: string, approvedBy: string): Promise<AdminUserRecord> {
    const user = await this.getAdminUser(userId);

    await this.crud.update("admin_users", userId, {
      status: "Approved",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy
    });

    return this.getAdminUser(userId);
  }

  async deleteAdminUser(userId: string): Promise<void> {
    await this.getAdminUser(userId);
    await this.crud.delete("admin_users", userId);
  }

  async markAdminUserLogin(email: string): Promise<void> {
    const existing = await firstQuery(
      this.db,
      `SELECT id FROM admin_users WHERE email = ? AND status = 'Approved' LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (!existing?.id) {
      return;
    }

    await this.crud.update("admin_users", String(existing.id), {
      last_login_at: new Date().toISOString()
    });
  }

  async writeAuditLog(
    actor: AdminActor,
    action: string,
    targetType: string,
    targetId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const record: AuditLogRecord = {
      id: crypto.randomUUID(),
      actor_email: actor.email,
      actor_method: actor.method,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ? JSON.stringify(details) : null,
      created_at: new Date().toISOString()
    };

    await this.crud.create("audit_log", { ...record });
  }

  async createTemplate(input: TemplateInput): Promise<TemplateRecord> {
    const template: TemplateRecord = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      type: input.type,
      content: input.content.trim(),
      active: input.active
    };

    await this.crud.create("templates", { ...template });
    return template;
  }

  async updateTemplate(templateId: string, patch: Partial<TemplateInput>): Promise<TemplateRecord> {
    await this.getTemplate(templateId);
    await this.crud.update("templates", templateId, {
      name: patch.name?.trim(),
      type: patch.type,
      content: patch.content?.trim(),
      active: patch.active
    });
    return this.getTemplate(templateId);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.getTemplate(templateId);
    await this.crud.delete("templates", templateId);
  }

  async generateCertificate(
    studentId: string,
    templateId: string,
    issuedOn?: string
  ): Promise<{
    refNo: string;
    html: string;
    academicYear: string;
    generatedOn: string;
  }> {
    const student = await this.getStudent(studentId);

    if (student.status !== "Approved") {
      throw new AppError(400, "Cannot generate certificate for a non-approved student");
    }

    const branch = await this.getBranch(student.branch);
    const template = await this.getTemplate(templateId);

    if (!template.active) {
      throw new AppError(400, "Selected template is inactive");
    }

    if (template.type !== student.cert_type) {
      throw new AppError(400, "Template type must match the student certificate type");
    }

    const issuedDate = issuedOn ? new Date(`${issuedOn}T00:00:00`) : new Date();
    const issueYear = issuedDate.getFullYear();
    const maxLoggedSerial = await this.findMaxSerialForBranchYear(branch.code, issueYear);
    const startingSerial =
      issueYear === branch.serial_year
        ? Math.max(branch.current_serial, maxLoggedSerial)
        : maxLoggedSerial;
    const generatedOn = new Date().toISOString();
    const academicYear = getAcademicYear(issuedDate);

    const data = {
      date: formatShortDate(issuedDate),
      student_name: student.full_name,
      reg_no: student.reg_no,
      branch_name: branch.name,
      branch_code: branch.code,
      company: student.company,
      cert_type: student.cert_type,
      duration: student.duration,
      start_date: student.start_date,
      start_date_long: formatLongDate(student.start_date),
      session: student.session,
      year: student.year,
      hod_name: branch.hod_name,
      hod_email: branch.hod_email,
      hod_mobile: branch.hod_mobile,
      hr_title: student.company_hr_title,
      company_address_html: student.company_address.replace(/\r?\n/g, "<br />")
    };

    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const nextSerial = startingSerial + attempt;
      const refNo = buildReference(branch.code, nextSerial, issueYear);
      const html = applyTemplate(template.content, {
        ...data,
        ref_no: refNo
      });

      try {
        await this.db.batch([
          this.db
            .prepare(
              `UPDATE branches
               SET current_serial = CASE
                     WHEN serial_year < ? THEN ?
                     WHEN serial_year = ? THEN MAX(current_serial, ?)
                     ELSE current_serial
                   END,
                   serial_year = CASE
                     WHEN serial_year < ? THEN ?
                     ELSE serial_year
                   END
               WHERE code = ?`
            )
            .bind(issueYear, nextSerial, issueYear, nextSerial, issueYear, issueYear, branch.code),
          this.db
            .prepare(
              `INSERT INTO certificate_log
               (ref_no, student_id, template_id, generated_on, academic_year)
               VALUES (?, ?, ?, ?, ?)`
            )
            .bind(refNo, student.id, template.id, generatedOn, academicYear)
        ]);

        return {
          refNo,
          html,
          academicYear,
          generatedOn
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !message.toLowerCase().includes("unique") &&
          !message.toLowerCase().includes("constraint")
        ) {
          throw error;
        }
      }
    }

    throw new AppError(409, `Unable to generate a unique reference number for ${branch.code}`);
  }

  private async findBranch(code: string): Promise<BranchRecord | null> {
    const record = (await this.crud.read("branches", { code }))[0];
    return record ? normalizeBranch(record) : null;
  }

  private async findCompany(name: string): Promise<CompanyRecord | null> {
    const record = (await this.crud.read("companies", { name }))[0];
    return record ? normalizeCompany(record) : null;
  }

  private async findDurationPolicy(
    certType: string,
    label: string
  ): Promise<DurationPolicyRecord | null> {
    const record = await firstQuery(
      this.db,
      `SELECT * FROM duration_policies WHERE cert_type = ? AND label = ? LIMIT 1`,
      [certType, label]
    );
    return record ? normalizeDurationPolicy(record) : null;
  }

  private async getStudent(studentId: string): Promise<StudentRecord> {
    const record = (await this.crud.read("students", { id: studentId }))[0];

    if (!record) {
      throw new AppError(404, "Student not found");
    }

    return normalizeStudent(record);
  }

  private async getAdminUser(userId: string): Promise<AdminUserRecord> {
    const record = (await this.crud.read("admin_users", { id: userId }))[0];

    if (!record) {
      throw new AppError(404, "Admin sign-in request not found");
    }

    return normalizeAdminUser(record);
  }

  private async getBranch(code: string): Promise<BranchRecord> {
    const record = (await this.crud.read("branches", { code }))[0];

    if (!record) {
      throw new AppError(404, `Missing branch: ${code}`);
    }

    return normalizeBranch(record);
  }

  private async getCompany(name: string): Promise<CompanyRecord> {
    const record = (await this.crud.read("companies", { name }))[0];

    if (!record) {
      throw new AppError(404, `Missing company: ${name}`);
    }

    return normalizeCompany(record);
  }

  private async getAcademicSession(
    value: string,
    activeOnly: boolean
  ): Promise<AcademicSessionRecord> {
    const filters: Record<string, unknown> = { value: value.trim() };

    if (activeOnly) {
      filters.active = 1;
    }

    const record = (await this.crud.read("academic_sessions", filters))[0];

    if (!record) {
      throw new AppError(404, `Missing academic session: ${value}`);
    }

    return normalizeAcademicSession(record);
  }

  private async getDurationPolicy(
    certType: string,
    label: string,
    activeOnly: boolean
  ): Promise<DurationPolicyRecord> {
    const record = await firstQuery(
      this.db,
      `SELECT * FROM duration_policies
       WHERE cert_type = ? AND label = ? ${activeOnly ? "AND active = 1" : ""}
       LIMIT 1`,
      [certType, label]
    );

    if (!record) {
      throw new AppError(404, `Missing duration option: ${label}`);
    }

    return normalizeDurationPolicy(record);
  }

  private async getDurationPolicyById(id: string): Promise<DurationPolicyRecord> {
    const record = (await this.crud.read("duration_policies", { id }))[0];

    if (!record) {
      throw new AppError(404, "Duration option not found");
    }

    return normalizeDurationPolicy(record);
  }

  private async getTemplate(templateId: string): Promise<TemplateRecord> {
    const record = (await this.crud.read("templates", { id: templateId }))[0];

    if (!record) {
      throw new AppError(404, "Missing template");
    }

    return normalizeTemplate(record);
  }

  private async findMaxSerialForBranchYear(branchCode: string, year: number): Promise<number> {
    const rows = await runQuery<{ ref_no: string }>(
      this.db,
      `SELECT ref_no FROM certificate_log WHERE ref_no LIKE ?`,
      [`TAT/${branchCode}/%/${year}`]
    );

    let maxSerial = 0;

    for (const row of rows) {
      const parts = row.ref_no.split("/");
      const serial = Number(parts[2]);
      if (Number.isFinite(serial) && serial > maxSerial) {
        maxSerial = serial;
      }
    }

    return maxSerial;
  }

  private async upsertCompanyFromStudent(student: StudentRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO companies (name, hr_title, address)
         VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           hr_title = excluded.hr_title,
           address = excluded.address`
      )
      .bind(student.company, student.company_hr_title, student.company_address)
      .run();
  }
}
