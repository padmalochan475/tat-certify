import { z } from "zod";

export const certificateTypeSchema = z.enum(["Internship", "Apprenticeship"]);
export const studentStatusSchema = z.enum(["Pending", "Approved"]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const sessionSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "Expected academic session like 2023-2027");

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

export const branchInputSchema = z
  .object({
    code: z.string().trim().min(2).max(20),
    name: z.string().trim().min(2).max(120),
    hod_name: z.string().trim().min(3).max(120),
    hod_email: z.email().max(120),
    hod_mobile: z.string().trim().min(10).max(20),
    current_serial: z.number().int().nonnegative().optional(),
    serial_year: z.number().int().min(2000).max(9999).optional()
  })
  .strict();

export const companyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    hr_title: z.string().trim().min(2).max(120),
    address: z.string().trim().min(8).max(500)
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
    content: z.string().trim().min(50),
    active: z.boolean().default(true)
  })
  .strict();

export const adminLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(120)
  })
  .strict();

export const templateUpdateSchema = templateInputSchema.partial().strict();
export const certificateRequestSchema = z
  .object({
    studentId: z.string().uuid(),
    templateId: z.string().trim().min(1),
    issuedOn: isoDateSchema.optional()
  })
  .strict();

export type CertificateType = z.infer<typeof certificateTypeSchema>;
export type StudentStatus = z.infer<typeof studentStatusSchema>;
export type StudentInput = z.infer<typeof studentInputSchema>;
export type BranchInput = z.infer<typeof branchInputSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type DurationPolicyInput = z.infer<typeof durationPolicyInputSchema>;
export type AcademicSessionInput = z.infer<typeof academicSessionInputSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;

export interface StudentRecord extends StudentInput {
  id: string;
  status: StudentStatus;
  created_at: string;
}

export interface BranchRecord {
  code: string;
  name: string;
  hod_name: string;
  hod_email: string;
  hod_mobile: string;
  current_serial: number;
  serial_year: number;
}

export interface CompanyRecord {
  name: string;
  hr_title: string;
  address: string;
}

export interface AcademicSessionRecord {
  value: string;
  active: boolean;
}

export interface DurationPolicyRecord {
  id: string;
  cert_type: CertificateType;
  label: string;
  active: boolean;
}

export interface TemplateRecord {
  id: string;
  name: string;
  type: CertificateType;
  content: string;
  active: boolean;
}
