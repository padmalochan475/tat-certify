-- ============================================
-- Enhanced Architecture V2.0 Migration
-- Phase 1: Foundation - JSON-Driven Template System
-- ============================================

-- ============================================
-- 1. UPDATE EXISTING TABLES
-- ============================================

-- Add new columns to branches table
ALTER TABLE branches ADD COLUMN prefix TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN hod_designation TEXT NOT NULL DEFAULT 'HOD';
ALTER TABLE branches ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE branches ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- Add new columns to companies table
ALTER TABLE companies ADD COLUMN id TEXT;
ALTER TABLE companies ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- Add new columns to academic_sessions table
ALTER TABLE academic_sessions ADD COLUMN created_at TEXT NOT NULL DEFAULT '';

-- Add new columns to duration_policies table
ALTER TABLE duration_policies ADD COLUMN created_at TEXT NOT NULL DEFAULT '';

-- ============================================
-- 2. CREATE NEW TABLES
-- ============================================

-- Branch Contacts (for signature collection)
CREATE TABLE IF NOT EXISTS branch_contacts (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT,
  office_location TEXT,
  available_timing TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(branch_id) REFERENCES branches(code)
);

-- JSON-Driven Templates (replaces old templates table)
CREATE TABLE IF NOT EXISTS templates_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Internship', 'Apprenticeship', 'Custom')),
  version INTEGER NOT NULL DEFAULT 1,
  template_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

-- Template Versions (for version control)
CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template_json TEXT NOT NULL,
  changes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY(template_id) REFERENCES templates_v2(id)
);

-- Applications (replaces students table)
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_no TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  form_data TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'processing', 'completed', 'failed')),
  submitted_at TEXT,
  approved_at TEXT,
  approved_by TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(template_id) REFERENCES templates_v2(id),
  FOREIGN KEY(branch_id) REFERENCES branches(code)
);

-- Enhanced Certificate Log
CREATE TABLE IF NOT EXISTS certificate_log_v2 (
  ref_no TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  pdf_url TEXT NOT NULL,
  generated_on TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  revoked_by TEXT,
  revoked_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(application_id) REFERENCES applications(id),
  FOREIGN KEY(template_id) REFERENCES templates_v2(id)
);

-- Certificate Versions (for edit tracking)
CREATE TABLE IF NOT EXISTS certificate_versions (
  id TEXT PRIMARY KEY,
  certificate_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  pdf_url TEXT NOT NULL,
  changes TEXT NOT NULL,
  edited_by TEXT NOT NULL,
  edit_reason TEXT,
  created_at TEXT NOT NULL,
  superseded INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(certificate_id) REFERENCES certificate_log_v2(ref_no)
);

-- Department Serials (atomic counter per branch per year)
CREATE TABLE IF NOT EXISTS department_serials (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  current_serial INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(branch_id, year),
  FOREIGN KEY(branch_id) REFERENCES branches(code)
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_branch_contacts_branch ON branch_contacts(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_contacts_active ON branch_contacts(active);
CREATE INDEX IF NOT EXISTS idx_templates_v2_type ON templates_v2(type);
CREATE INDEX IF NOT EXISTS idx_templates_v2_active ON templates_v2(active);
CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_branch ON applications(branch_id);
CREATE INDEX IF NOT EXISTS idx_applications_template ON applications(template_id);
CREATE INDEX IF NOT EXISTS idx_applications_reg_no ON applications(reg_no);
CREATE INDEX IF NOT EXISTS idx_certificate_log_v2_application ON certificate_log_v2(application_id);
CREATE INDEX IF NOT EXISTS idx_certificate_log_v2_academic_year ON certificate_log_v2(academic_year);
CREATE INDEX IF NOT EXISTS idx_cert_versions_cert ON certificate_versions(certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_versions_version ON certificate_versions(version);
CREATE INDEX IF NOT EXISTS idx_dept_serials_branch_year ON department_serials(branch_id, year);

-- ============================================
-- 4. UPDATE ADMIN USERS TABLE
-- ============================================

-- Add role column to admin_users
ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'Admin' CHECK (role IN ('Admin', 'SuperAdmin'));

-- ============================================
-- NOTES:
-- ============================================
-- 1. Old tables (students, templates, certificate_log) are kept for backward compatibility
-- 2. New tables use _v2 suffix or new names (applications, templates_v2, certificate_log_v2)
-- 3. Migration of existing data should be done separately via API or script
-- 4. Once migration is complete, old tables can be dropped in a future migration
-- ============================================
