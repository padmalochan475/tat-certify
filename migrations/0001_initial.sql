CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  reg_no TEXT NOT NULL,
  branch TEXT NOT NULL,
  year TEXT NOT NULL,
  session TEXT NOT NULL,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('Internship', 'Apprenticeship')),
  company TEXT NOT NULL,
  company_hr_title TEXT NOT NULL,
  company_address TEXT NOT NULL,
  duration TEXT NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hod_name TEXT NOT NULL,
  hod_email TEXT NOT NULL,
  hod_mobile TEXT NOT NULL,
  current_serial INTEGER NOT NULL DEFAULT 0,
  serial_year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_sessions (
  value TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS duration_policies (
  id TEXT PRIMARY KEY,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('Internship', 'Apprenticeship')),
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS companies (
  name TEXT PRIMARY KEY,
  hr_title TEXT NOT NULL,
  address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Internship', 'Apprenticeship')),
  content TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS certificate_log (
  ref_no TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  generated_on TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  FOREIGN KEY(student_id) REFERENCES students(id),
  FOREIGN KEY(template_id) REFERENCES templates(id)
);

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
