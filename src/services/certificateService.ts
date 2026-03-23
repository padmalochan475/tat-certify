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
  StudentInput,
  StudentRecord,
  TemplateInput,
  TemplateRecord,
  LegacyTemplateRecord,
  ApplicationRecord,
  BranchContactRecord,
  CertificateType,
  StudentStatus,
  AuthProvider,
  AdminRole,
  AdminUserStatus,
  ApplicationStatus
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
  students: StudentRecord[];
  templates: LegacyTemplateRecord[];
  templatesV2: TemplateRecord[];
  applications: ApplicationRecord[];
  branchContacts: BranchContactRecord[];
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

function normalizeTemplate(record: RowRecord): LegacyTemplateRecord {
  return {
    id: String(record.id),
    name: String(record.name),
    type: String(record.type) as CertificateType,
    content: String(record.content),
    active: Boolean(record.active)
  };
}

function normalizeTemplateV2(record: RowRecord): TemplateRecord {
  return {
    id: String(record.id),
    name: String(record.name),
    type: String(record.type) as CertificateType,
    version: Number(record.version),
    template_json: String(record.template_json),
    active: Boolean(record.active),
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
    created_by: String(record.created_by)
  };
}

function normalizeBranch(record: RowRecord): BranchRecord {
  return {
    code: String(record.code),
    name: String(record.name),
    prefix: String(record.prefix || ""),
    hod_name: String(record.hod_name),
    hod_designation: String(record.hod_designation || "HOD"),
    hod_email: String(record.hod_email),
    hod_mobile: String(record.hod_mobile),
    current_serial: Number(record.current_serial || 0),
    serial_year: Number(record.serial_year || new Date().getFullYear()),
    active: Boolean(record.active),
    created_at: String(record.created_at || ""),
    updated_at: String(record.updated_at || "")
  };
}

function normalizeCompany(record: RowRecord): CompanyRecord {
  return {
    id: String(record.id),
    name: String(record.name),
    hr_title: String(record.hr_title),
    address: String(record.address),
    verified: Boolean(record.verified),
    created_at: String(record.created_at || ""),
    updated_at: String(record.updated_at || "")
  };
}

function normalizeAcademicSession(record: RowRecord): AcademicSessionRecord {
  return {
    value: String(record.value),
    active: Boolean(record.active),
    created_at: String(record.created_at || "")
  };
}

function normalizeDurationPolicy(record: RowRecord): DurationPolicyRecord {
  return {
    id: String(record.id),
    cert_type: String(record.cert_type) as CertificateType,
    label: String(record.label),
    active: Boolean(record.active),
    created_at: String(record.created_at || "")
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
    cert_type: String(record.cert_type) as CertificateType,
    company: String(record.company),
    company_hr_title: String(record.company_hr_title),
    company_address: String(record.company_address),
    duration: String(record.duration),
    start_date: String(record.start_date),
    status: String(record.status) as StudentStatus,
    created_at: String(record.created_at)
  };
}

function normalizeAdminUser(record: RowRecord): AdminUserRecord {
  return {
    id: String(record.id),
    email: String(record.email),
    auth_provider: (record.auth_provider || "Google") as AuthProvider,
    role: (record.role || "Admin") as AdminRole,
    status: String(record.status) as AdminUserStatus,
    google_sub: record.google_sub ? String(record.google_sub) : null,
    created_at: String(record.created_at),
    approved_at: record.approved_at ? String(record.approved_at) : null,
    approved_by: record.approved_by ? String(record.approved_by) : null,
    last_login_at: record.last_login_at ? String(record.last_login_at) : null
  };
}

function normalizeApplication(record: RowRecord): ApplicationRecord {
  return {
    id: String(record.id),
    template_id: String(record.template_id),
    student_name: String(record.student_name),
    reg_no: String(record.reg_no),
    branch_id: String(record.branch_id),
    form_data: String(record.form_data),
    status: String(record.status) as ApplicationStatus,
    submitted_at: record.submitted_at ? String(record.submitted_at) : null,
    approved_at: record.approved_at ? String(record.approved_at) : null,
    approved_by: record.approved_by ? String(record.approved_by) : null,
    rejected_at: record.rejected_at ? String(record.rejected_at) : null,
    rejected_by: record.rejected_by ? String(record.rejected_by) : null,
    rejection_reason: record.rejection_reason ? String(record.rejection_reason) : null,
    created_at: String(record.created_at),
    updated_at: String(record.updated_at)
  };
}

function normalizeBranchContact(record: RowRecord): BranchContactRecord {
  return {
    id: String(record.id),
    branch_id: String(record.branch_id),
    contact_name: String(record.contact_name),
    designation: String(record.designation),
    mobile_number: String(record.mobile_number),
    email: record.email ? String(record.email) : null,
    office_location: record.office_location ? String(record.office_location) : null,
    available_timing: record.available_timing ? String(record.available_timing) : null,
    active: Boolean(record.active),
    priority: Number(record.priority || 1),
    created_at: String(record.created_at),
    updated_at: String(record.updated_at)
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

  async getAdminBootstrap(): Promise<AdminBootstrapPayload> {
    const [
      adminUsersResult,
      auditLogResult,
      studentsResult,
      branchesResult,
      companiesResult,
      sessionsResult,
      durationsResult,
      templatesResult,
      templatesV2Result,
      certificateLogResult,
      applicationsResult,
      branchContactsResult
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
      this.db.prepare(`SELECT * FROM templates_v2 ORDER BY active DESC, name ASC`),
      this.db.prepare(
        `SELECT l.ref_no,
                l.generated_on,
                l.academic_year,
                COALESCE(s.full_name, a.student_name) AS student_name,
                COALESCE(s.reg_no, a.reg_no) AS reg_no,
                COALESCE(s.cert_type, t1.type, t2.type) AS cert_type, 
                COALESCE(t1.name, t2.name) AS template_name
         FROM certificate_log l
         LEFT JOIN students s ON s.id = l.student_id
         LEFT JOIN applications a ON a.id = l.application_id
         LEFT JOIN templates t1 ON t1.id = l.template_id
         LEFT JOIN templates_v2 t2 ON t2.id = l.template_id
         ORDER BY datetime(l.generated_on) DESC
         LIMIT 100`
      ),
      this.db.prepare(`SELECT * FROM applications ORDER BY created_at DESC LIMIT 200`),
      this.db.prepare(`SELECT * FROM branch_contacts ORDER BY priority ASC, contact_name ASC`)
    ]);

    // Map legacy students to the application model for a unified UI
    const legacyApplications: ApplicationRecord[] = studentsResult.results.map((s: any) => ({
      id: s.id,
      template_id: '', // Legacy templates handled by fallbacks
      student_name: s.full_name,
      reg_no: s.reg_no,
      branch_id: s.branch,
      form_data: JSON.stringify({
        cert_type: s.cert_type,
        duration: s.duration,
        start_date: s.start_date,
        company_name: s.company,
        company_hr_title: s.company_hr_title,
        company_address: s.company_address,
        session: s.session,
        year: s.year
      }),
      status: s.status.toLowerCase() as ApplicationStatus,
      submitted_at: s.created_at,
      approved_at: s.status === 'Approved' ? s.created_at : null,
      approved_by: null,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      created_at: s.created_at,
      updated_at: s.created_at,
      is_legacy: true // Marker for UI
    }));

    const v2Applications = applicationsResult.results.map((record) => normalizeApplication(record as RowRecord));
    const mergedApplications = [...v2Applications, ...legacyApplications].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      adminUsers: adminUsersResult.results.map((record) => normalizeAdminUser(record as RowRecord)),
      auditLog: auditLogResult.results.map((record) => normalizeAuditLog(record as RowRecord)),
      students: [], // Now unified in applications
      branches: branchesResult.results.map((record) => normalizeBranch(record as RowRecord)),
      companies: companiesResult.results.map((record) => normalizeCompany(record as RowRecord)),
      sessions: sessionsResult.results.map((record) => normalizeAcademicSession(record as RowRecord)),
      durations: durationsResult.results.map((record) => normalizeDurationPolicy(record as RowRecord)),
      templates: templatesResult.results.map((record) => normalizeTemplate(record as RowRecord)),
      templatesV2: templatesV2Result.results.map((record) => normalizeTemplateV2(record as RowRecord)),
      applications: mergedApplications,
      branchContacts: branchContactsResult.results.map((record) => normalizeBranchContact(record as RowRecord)),
      certificateLog: certificateLogResult.results as any[]
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
    const now = new Date().toISOString();
    const branch: BranchRecord = {
      code,
      name: input.name.trim(),
      prefix: input.prefix?.trim() || existing?.prefix || "",
      hod_name: input.hod_name?.trim() || "",
      hod_designation: input.hod_designation?.trim() || existing?.hod_designation || "HOD",
      hod_email: input.hod_email?.trim() || "",
      hod_mobile: input.hod_mobile?.trim() || "",
      current_serial: input.current_serial ?? existing?.current_serial ?? 0,
      serial_year: input.serial_year ?? existing?.serial_year ?? new Date().getFullYear(),
      active: input.active ?? existing?.active ?? true,
      created_at: existing?.created_at || now,
      updated_at: now
    };

    await this.db
      .prepare(
        `INSERT INTO branches
         (code, name, prefix, hod_name, hod_designation, hod_email, hod_mobile, current_serial, serial_year, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           name = excluded.name,
           prefix = excluded.prefix,
           hod_name = excluded.hod_name,
           hod_designation = excluded.hod_designation,
           hod_email = excluded.hod_email,
           hod_mobile = excluded.hod_mobile,
           current_serial = excluded.current_serial,
           serial_year = excluded.serial_year,
           active = excluded.active,
           updated_at = excluded.updated_at`
      )
      .bind(
        branch.code,
        branch.name,
        branch.prefix,
        branch.hod_name,
        branch.hod_designation,
        branch.hod_email,
        branch.hod_mobile,
        branch.current_serial,
        branch.serial_year,
        branch.active ? 1 : 0,
        branch.created_at,
        branch.updated_at
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
    const name = input.name.trim();
    const existing = await this.findCompany(name);
    const now = new Date().toISOString();
    const company: CompanyRecord = {
      id: existing?.id || crypto.randomUUID(),
      name,
      hr_title: input.hr_title.trim(),
      address: input.address.trim(),
      verified: input.verified ?? existing?.verified ?? false,
      created_at: existing?.created_at || now,
      updated_at: now
    };

    await this.db
      .prepare(
        `INSERT INTO companies (id, name, hr_title, address, verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           hr_title = excluded.hr_title,
           address = excluded.address,
           verified = excluded.verified,
           updated_at = excluded.updated_at`
      )
      .bind(company.id, company.name, company.hr_title, company.address, company.verified ? 1 : 0, company.created_at, company.updated_at)
      .run();

    return this.getCompany(company.name);
  }

  async deleteCompany(name: string): Promise<void> {
    await this.getCompany(name);
    await this.crud.delete("companies", name);
  }

  async saveAcademicSession(input: AcademicSessionInput): Promise<AcademicSessionRecord> {
    const now = new Date().toISOString();
    const session: AcademicSessionRecord = {
      value: input.value.trim(),
      active: input.active ?? true,
      created_at: now
    };

    await this.db
      .prepare(
        `INSERT INTO academic_sessions (value, active, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(value) DO UPDATE SET
           active = excluded.active`
      )
      .bind(session.value, session.active ? 1 : 0, session.created_at)
      .run();

    return this.getAcademicSession(session.value, false);
  }

  async saveDurationPolicy(input: DurationPolicyInput): Promise<DurationPolicyRecord> {
    const label = input.label.trim();
    const existing = await this.findDurationPolicy(input.cert_type, label);
    const now = new Date().toISOString();
    const record: DurationPolicyRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      cert_type: input.cert_type,
      label,
      active: input.active ?? true,
      created_at: existing?.created_at || now
    };

    await this.db
      .prepare(
        `INSERT INTO duration_policies (id, cert_type, label, active, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           cert_type = excluded.cert_type,
           label = excluded.label,
           active = excluded.active`
      )
      .bind(record.id, record.cert_type, record.label, record.active ? 1 : 0, record.created_at)
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
      role: "Admin",
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

  async createTemplate(input: {
    name: string;
    type: CertificateType;
    content: string;
    active: boolean;
  }): Promise<LegacyTemplateRecord> {
    const template: LegacyTemplateRecord = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      type: input.type,
      content: input.content.trim(),
      active: input.active
    };

    await this.crud.create("templates", { ...template });
    return template;
  }

  async updateTemplate(templateId: string, patch: Partial<{
    name: string;
    type: CertificateType;
    content: string;
    active: boolean;
  }>): Promise<LegacyTemplateRecord> {
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
    subjectId: string,
    templateId: string,
    issuedOn?: string
  ): Promise<{
    refNo: string;
    html: string;
    academicYear: string;
    generatedOn: string;
  }> {
    const subject = await this.getGenericSubject(subjectId);
    const template = await this.getGenericTemplate(templateId);

    if (subject.status !== "Approved" && subject.status !== "approved") {
      throw new AppError(400, "Cannot generate certificate for a non-approved request");
    }

    const branch = await this.getBranch(subject.branch_id);
    if (!template.active) {
      throw new AppError(400, "Selected template is inactive");
    }

    if (template.type !== subject.cert_type) {
      throw new AppError(400, "Template type must match the certificate type");
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
      ...subject.data,
      date: formatShortDate(issuedDate),
      branch_name: branch.name,
      branch_code: branch.code,
      hod_name: branch.hod_name,
      hod_email: branch.hod_email,
      hod_mobile: branch.hod_mobile,
      hod_designation: branch.hod_designation,
      start_date_long: formatLongDate(subject.data.start_date || ""),
      issue_date: formatLongDate(issuedDate.toISOString())
    };

    // Find first active branch contact for priority
    const contact = await firstQuery<any>(
      this.db,
      `SELECT * FROM branch_contacts WHERE branch_id = ? AND active = 1 ORDER BY priority ASC LIMIT 1`,
      [branch.code]
    );

    if (contact) {
      Object.assign(data, {
        contact_name: contact.contact_name,
        contact_designation: contact.designation,
        contact_mobile: contact.mobile_number,
        contact_email: contact.email
      });
    }

    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const nextSerial = startingSerial + attempt;
      const refNo = buildReference(branch.code, nextSerial, issueYear);
        const qrCodeData = `${new URL(this.db.toString()).origin}/verify/${refNo}`; 
        const html = applyTemplate(template.content, {
          ...data,
          ref_no: refNo,
          qr_code_url: qrCodeData,
          qr_code_data_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeData)}`
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
               (ref_no, student_id, application_id, template_id, generated_on, academic_year)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
              refNo, 
              subject.isV2 ? null : subject.id,
              subject.isV2 ? subject.id : null,
              template.id, 
              generatedOn, 
              academicYear
            )
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

  private async getGenericSubject(id: string): Promise<{
    id: string;
    branch_id: string;
    cert_type: string;
    status: string;
    isV2: boolean;
    data: Record<string, any>;
  }> {
    // Try application first (V2)
    const appRecord = (await this.crud.read("applications", { id }))[0];
    if (appRecord) {
      const app = normalizeApplication(appRecord);
      const formData = JSON.parse(app.form_data);
      return {
        id: app.id,
        branch_id: app.branch_id,
        cert_type: formData.cert_type,
        status: app.status,
        isV2: true,
        data: {
          ...formData,
          student_name: app.student_name,
          reg_no: app.reg_no
        }
      };
    }

    // fallback to legacy student
    const student = await this.getStudent(id);
    return {
      id: student.id,
      branch_id: student.branch,
      cert_type: student.cert_type,
      status: student.status,
      isV2: false,
      data: {
        student_name: student.full_name,
        reg_no: student.reg_no,
        cert_type: student.cert_type,
        company: student.company,
        duration: student.duration,
        start_date: student.start_date,
        hr_title: student.company_hr_title,
        company_address: student.company_address,
        company_address_html: student.company_address.replace(/\r?\n/g, "<br />")
      }
    };
  }

  private async getGenericTemplate(id: string): Promise<{
    id: string;
    type: string;
    content: string;
    active: boolean;
    isV2: boolean;
  }> {
    // Try V2 first
    const v2Record = (await this.crud.read("templates_v2", { id }))[0];
    if (v2Record) {
      const t = normalizeTemplateV2(v2Record);
      const config = JSON.parse(t.template_json);
      return {
        id: t.id,
        type: t.type,
        content: config.format_html || config.html || config.content || "",
        active: t.active,
        isV2: true
      };
    }

    const t = await this.getTemplate(id);
    return {
      id: t.id,
      type: t.type,
      content: t.content,
      active: t.active,
      isV2: false
    };
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

  private async getTemplate(templateId: string): Promise<LegacyTemplateRecord> {
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

  async migrateLegacyStudents(actorEmail: string): Promise<{ migrated: number }> {
    const students = await runQuery<any>(this.db, 'SELECT * FROM students');
    if (students.length === 0) return { migrated: 0 };

    // Get a default V2 template for migration or create one
    let template = await firstQuery<any>(
      this.db, 
      'SELECT id FROM templates_v2 WHERE active = 1 LIMIT 1'
    );

    if (!template) {
      // Create a basic migration template if none exists
      const templateId = crypto.randomUUID();
      const now = new Date().toISOString();
      await this.db.prepare(
        `INSERT INTO templates_v2 (id, name, type, version, template_json, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        templateId, 'Migration Template', 'Internship', 1, 
        JSON.stringify({ 
          sections: { body: { paragraphs: ["{{student_name}} has completed their {{cert_type}} at {{company_name}}."] } },
          form_fields: []
        }),
        1, now, now
      ).run();
      template = { id: templateId };
    }

    let migrated = 0;
    for (const student of students) {
      const appId = student.id; // Keep same ID for traceability
      const now = student.created_at;
      const statusMap: Record<string, ApplicationStatus> = {
        'Pending': 'submitted',
        'Approved': 'approved',
        'Rejected': 'rejected'
      };

      const formData = {
        cert_type: student.cert_type,
        duration: student.duration,
        start_date: student.start_date,
        company_name: student.company,
        company_hr_title: student.company_hr_title,
        company_address: student.company_address,
        session: student.session,
        year: student.year
      };

      try {
        await this.db.prepare(
          `INSERT INTO applications (
            id, template_id, student_name, reg_no, branch_id, 
            form_data, status, created_at, updated_at, submitted_at, approved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          appId,
          template.id,
          student.full_name,
          student.reg_no,
          student.branch,
          JSON.stringify(formData),
          statusMap[student.status] || 'submitted',
          now,
          new Date().toISOString(),
          now,
          student.status === 'Approved' ? now : null
        ).run();

        // Update any log entries to point to this application_id
        await this.db.prepare(
          'UPDATE certificate_log SET application_id = ? WHERE student_id = ?'
        ).bind(appId, student.id).run();

        migrated++;
      } catch (e) {
        console.error(`Migration failed for student ${student.id}:`, e);
      }
    }

    // Optionally cleanup legacy table
    // await this.db.prepare('DELETE FROM students').run();

    await this.writeAuditLog(
      { email: actorEmail, method: 'system' }, 
      'system.migrate_legacy', 
      'system', 
      'migration', 
      { count: migrated }
    );

    return { migrated };
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
