import { z } from "zod";

// ============================================
// ENUMS & BASE SCHEMAS
// ============================================

export const certificateTypeSchema = z.enum(["Internship", "Apprenticeship", "Custom"]);
export const studentStatusSchema = z.enum(["Pending", "Approved"]);
export const applicationStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "rejected",
  "processing",
  "completed",
  "failed"
]);
export const adminUserStatusSchema = z.enum(["Pending", "Approved"]);
export const adminRoleSchema = z.enum(["Admin", "SuperAdmin"]);
export const authProviderSchema = z.enum(["Password", "Google"]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const sessionSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "Expected academic session like 2023-2027");

// ============================================
// LEGACY SCHEMAS (for backward compatibility)
// ============================================

export const studentInputSchema = z
  .object({
    full_name: z.string().trim().min(3).max(120),
    reg_no: z.string().trim().min(3).max(30),
    branch: z.string().trim().min(2).max(20),
    year: z.string().trim().min(2).max(30),
    session: sessionSchema,
    cert_type: certificateTypeSchema,
    company: z.string().trim().min(2).max(120),
    company_hr_title: z.string().trim().min(2).max(120),
    company_address: z.string().trim().min(8).max(500),
    duration: z.string().trim().min(2).max(80),
    start_date: isoDateSchema
  })
  .strict();

// ============================================
// JSON TEMPLATE SCHEMAS
// ============================================

// QR Settings
export const qrSettingsSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]),
  size: z.number().int().min(50).max(200)
});

// Template Sections
export const templateHeaderSchema = z.object({
  enabled: z.boolean(),
  logo_url: z.string().url().optional(),
  title: z.string().min(1).max(200)
});

export const templateMetaSchema = z.object({
  ref_no: z.string().min(1),
  date: z.string().min(1)
});

export const templateReceiverSchema = z.object({
  to: z.string().min(1),
  company: z.string().min(1),
  address: z.string().min(1)
});

export const templateSubjectSchema = z.object({
  text: z.string().min(1)
});

export const templateConditionSchema = z.object({
  if: z.string().min(1),
  then: z.string().min(1)
});

export const templateBodySchema = z.object({
  paragraphs: z.array(z.string().min(1)),
  conditions: z.array(templateConditionSchema).optional()
});

export const templateSignatureSchema = z.object({
  name: z.string().min(1),
  designation: z.string().min(1),
  email: z.string().email().optional(),
  mobile: z.string().optional()
});

export const templateFooterSchema = z.object({
  enabled: z.boolean(),
  text: z.string().min(1)
});

export const templateSectionsSchema = z.object({
  header: templateHeaderSchema,
  meta: templateMetaSchema,
  receiver: templateReceiverSchema,
  subject: templateSubjectSchema,
  body: templateBodySchema,
  signature: templateSignatureSchema,
  footer: templateFooterSchema
});

// Form Field Types
export const formFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "dropdown",
  "dropdown_with_other",
  "date",
  "number",
  "email",
  "phone"
]);

export const formFieldConditionalSchema = z.object({
  show_if: z.string().min(1)
});

export const formFieldSchema = z.object({
  name: z.string().min(1),
  type: formFieldTypeSchema,
  label: z.string().min(1),
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  default_value: z.any().optional(),
  validation: z.string().optional(), // e.g. "min:3,max:20"
  validation_msg: z.string().optional(),
  options: z.array(z.string()).optional(), // for dropdown
  source: z.string().optional(), // e.g. "companies", "branches"
  filter_by: z.string().optional(),
  conditional: formFieldConditionalSchema.optional(),
  full_width: z.boolean().default(false),
  hint: z.string().optional()
});

// Complete Template JSON Schema
export const templateJsonSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: certificateTypeSchema,
  version: z.number().int().positive().optional(),
  active: z.boolean().optional().default(true),
  format_html: z.string().min(10).optional(),
  form_fields: z.array(formFieldSchema).default([]),
  qr_settings: qrSettingsSchema.default({
    enabled: true,
    position: "bottom-right",
    size: 80
  }),
  header_mode: z.enum(["with_header", "canvas_only"]).default("with_header"),
  sections: templateSectionsSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional()
});

// ============================================
// INPUT SCHEMAS
// ============================================

export const branchInputSchema = z
  .object({
    code: z.string().trim().min(2).max(20),
    name: z.string().trim().min(2).max(120),
    prefix: z.string().trim().min(2).max(10),
    hod_name: z.string().trim().min(3).max(120),
    hod_designation: z.string().trim().min(2).max(50).default("HOD"),
    hod_email: z.email().max(120),
    hod_mobile: z.string().trim().min(10).max(20),
    current_serial: z.number().int().min(0).optional(),
    serial_year: z.number().int().min(2000).max(2100).optional(),
    active: z.boolean().default(true)
  })
  .strict();

export const branchContactInputSchema = z
  .object({
    branch_id: z.string().trim().min(2).max(20),
    contact_name: z.string().trim().min(3).max(120),
    designation: z.string().trim().min(2).max(50),
    mobile_number: z.string().trim().min(10).max(20),
    email: z.email().max(120).optional(),
    office_location: z.string().trim().max(200).optional(),
    available_timing: z.string().trim().max(100).optional(),
    active: z.boolean().default(true),
    priority: z.number().int().min(1).max(10).default(1)
  })
  .strict();

export const companyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    hr_title: z.string().trim().min(2).max(120),
    address: z.string().trim().min(8).max(500),
    verified: z.boolean().default(false)
  })
  .strict();

export const durationPolicyInputSchema = z
  .object({
    cert_type: certificateTypeSchema,
    label: z.string().trim().min(2).max(80),
    active: z.boolean().default(true)
  })
  .strict();

export const academicSessionInputSchema = z
  .object({
    value: sessionSchema,
    active: z.boolean().default(true)
  })
  .strict();

export const templateInputSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    type: certificateTypeSchema,
    content: z.string().min(10),
    active: z.boolean().default(true)
  })
  .strict();

export const templateV2InputSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    type: certificateTypeSchema,
    template_json: z.string().min(50), // JSON string
    active: z.boolean().default(true)
  })
  .strict();

export const applicationInputSchema = z
  .object({
    template_id: z.string().uuid(),
    student_name: z.string().trim().min(3).max(120),
    reg_no: z.string().trim().min(3).max(30),
    branch_id: z.string().trim().min(2).max(20),
    form_data: z.record(z.string(), z.any()) // Dynamic form data
  })
  .strict();

export const applicationUpdateSchema = z
  .object({
    status: applicationStatusSchema.optional(),
    approved_by: z.string().email().optional(),
    rejected_by: z.string().email().optional(),
    rejection_reason: z.string().trim().max(500).optional()
  })
  .strict();

export const certificateGenerateSchema = z
  .object({
    application_id: z.string().uuid(),
    template_id: z.string().uuid(),
    issue_date: isoDateSchema.optional()
  })
  .strict();

export const certificateRevokeSchema = z
  .object({
    revoked_by: z.string().email(),
    revoked_reason: z.string().trim().min(10).max(500)
  })
  .strict();

// ============================================
// AUTH SCHEMAS
// ============================================

export const adminLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(120)
  })
  .strict();

export const googleLoginSchema = z
  .object({
    credential: z.string().trim().min(1),
    client_id: z.string().trim().min(1).optional(),
    g_csrf_token: z.string().trim().min(1).optional()
  })
  .strict();

// ============================================
// UPDATE SCHEMAS
// ============================================

export const templateUpdateSchema = templateInputSchema.partial().strict();
export const templateV2UpdateSchema = templateV2InputSchema.partial().strict();
export const branchUpdateSchema = branchInputSchema.partial().strict();
export const companyUpdateSchema = companyInputSchema.partial().strict();
export const branchContactUpdateSchema = branchContactInputSchema.partial().strict();

// Legacy
export const certificateRequestSchema = z
  .object({
    studentId: z.string().uuid(),
    templateId: z.string().trim().min(1),
    issuedOn: isoDateSchema.optional()
  })
  .strict();

// ============================================
// TYPE EXPORTS
// ============================================

export type CertificateType = z.infer<typeof certificateTypeSchema>;
export type StudentStatus = z.infer<typeof studentStatusSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;

export type StudentInput = z.infer<typeof studentInputSchema>;
export type BranchInput = z.infer<typeof branchInputSchema>;
export type BranchContactInput = z.infer<typeof branchContactInputSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type DurationPolicyInput = z.infer<typeof durationPolicyInputSchema>;
export type AcademicSessionInput = z.infer<typeof academicSessionInputSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
export type TemplateV2Input = z.infer<typeof templateV2InputSchema>;
export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type ApplicationUpdate = z.infer<typeof applicationUpdateSchema>;

export type QRSettings = z.infer<typeof qrSettingsSchema>;
export type TemplateJson = z.infer<typeof templateJsonSchema>;
export type FormField = z.infer<typeof formFieldSchema>;

// ============================================
// RECORD INTERFACES
// ============================================

export interface StudentRecord extends StudentInput {
  id: string;
  status: StudentStatus;
  created_at: string;
}

export interface BranchRecord {
  code: string;
  name: string;
  prefix: string;
  hod_name: string;
  hod_designation: string;
  hod_email: string;
  hod_mobile: string;
  current_serial: number;
  serial_year: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchContactRecord {
  id: string;
  branch_id: string;
  contact_name: string;
  designation: string;
  mobile_number: string;
  email: string | null;
  office_location: string | null;
  available_timing: string | null;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  hr_title: string;
  address: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicSessionRecord {
  value: string;
  active: boolean;
  created_at: string;
}

export interface DurationPolicyRecord {
  id: string;
  cert_type: CertificateType;
  label: string;
  active: boolean;
  created_at: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  type: CertificateType;
  version: number;
  template_json: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface TemplateVersionRecord {
  id: string;
  template_id: string;
  version: number;
  template_json: string;
  changes: string | null;
  created_at: string;
  created_by: string;
}

export interface ApplicationRecord {
  id: string;
  template_id: string;
  student_name: string;
  reg_no: string;
  branch_id: string;
  form_data: string;
  status: ApplicationStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificateLogRecord {
  ref_no: string;
  application_id: string;
  template_id: string;
  version: number;
  pdf_url: string;
  generated_on: string;
  academic_year: string;
  revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_at: string;
}

export interface CertificateVersionRecord {
  id: string;
  certificate_id: string;
  version: number;
  pdf_url: string;
  changes: string;
  edited_by: string;
  edit_reason: string | null;
  created_at: string;
  superseded: boolean;
}

export interface DepartmentSerialRecord {
  id: string;
  branch_id: string;
  year: number;
  current_serial: number;
  updated_at: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  auth_provider: AuthProvider;
  role: AdminRole;
  status: AdminUserStatus;
  google_sub: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_login_at: string | null;
}

export interface AuditLogRecord {
  id: string;
  actor_email: string;
  actor_method: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  created_at: string;
}

// ============================================
// LEGACY INTERFACES (for backward compatibility)
// ============================================

export interface LegacyTemplateRecord {
  id: string;
  name: string;
  type: CertificateType;
  content: string;
  active: boolean;
}
