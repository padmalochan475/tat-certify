import type { CertificateType } from "./schema";

const schemaSql = [
  "CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, reg_no TEXT NOT NULL, branch TEXT NOT NULL, year TEXT NOT NULL, session TEXT NOT NULL, cert_type TEXT NOT NULL CHECK (cert_type IN ('Internship', 'Apprenticeship')), company TEXT NOT NULL, company_hr_title TEXT NOT NULL, company_address TEXT NOT NULL, duration TEXT NOT NULL, start_date TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved')), created_at TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS branches (code TEXT PRIMARY KEY, name TEXT NOT NULL, hod_name TEXT NOT NULL, hod_email TEXT NOT NULL, hod_mobile TEXT NOT NULL, current_serial INTEGER NOT NULL DEFAULT 0, serial_year INTEGER NOT NULL);",
  "CREATE TABLE IF NOT EXISTS academic_sessions (value TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 1);",
  "CREATE TABLE IF NOT EXISTS duration_policies (id TEXT PRIMARY KEY, cert_type TEXT NOT NULL CHECK (cert_type IN ('Internship', 'Apprenticeship')), label TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);",
  "CREATE TABLE IF NOT EXISTS companies (name TEXT PRIMARY KEY, hr_title TEXT NOT NULL, address TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('Internship', 'Apprenticeship')), content TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);",
  "CREATE TABLE IF NOT EXISTS certificate_log (ref_no TEXT PRIMARY KEY, student_id TEXT NOT NULL, template_id TEXT NOT NULL, generated_on TEXT NOT NULL, academic_year TEXT NOT NULL, FOREIGN KEY(student_id) REFERENCES students(id), FOREIGN KEY(template_id) REFERENCES templates(id));",
  "CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, auth_provider TEXT NOT NULL CHECK (auth_provider IN ('Google')), status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved')), google_sub TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, approved_at TEXT, approved_by TEXT, last_login_at TEXT);",
  "CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_email TEXT NOT NULL, actor_method TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS system_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);"
].join("\n");

function buildDefaultTemplate(type: CertificateType): string {
  const lower = type.toLowerCase();
  const article = /^[aeiou]/i.test(lower) ? "an" : "a";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ref_no}} - ${type}</title>
    <style>
      :root {
        --brand-blue: #173b84;
        --ink: #1a1a1a;
        --paper: #ffffff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 0;
        background: #f3f5f8;
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
      }

      .sheet {
        width: 210mm;
        height: 297mm;
        min-height: 297mm;
        margin: 0 auto;
        background: var(--paper);
        padding: 42mm 17mm 28mm;
        box-shadow: 0 18px 60px rgba(20, 29, 54, 0.14);
        position: relative;
        overflow: hidden;
      }

      .meta {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin: 0 0 18px;
        font: 600 15px Arial, sans-serif;
      }

      .letterhead-guide,
      .footer-guide {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(23, 59, 132, 0.42);
        font: 700 12px/1 Arial, sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        pointer-events: none;
      }

      .letterhead-guide {
        top: 0;
        height: 34mm;
        border-bottom: 1px dashed rgba(23, 59, 132, 0.18);
        background: linear-gradient(180deg, rgba(23, 59, 132, 0.04), transparent);
      }

      .footer-guide {
        bottom: 0;
        height: 18mm;
        border-top: 1px dashed rgba(23, 59, 132, 0.14);
      }

      .body {
        font-size: 15.6px;
        line-height: 1.5;
      }

      .body p {
        margin: 0 0 12px;
      }

      .subject {
        font-weight: 700;
      }

      .justify {
        text-align: justify;
      }

      .signature {
        margin-top: 28px;
        font: 15px/1.45 Arial, sans-serif;
      }

      @media print {
        body {
          background: #fff;
          padding: 0;
        }

        .sheet {
          box-shadow: none;
          width: auto;
          min-height: auto;
          margin: 0;
          padding: 42mm 17mm 24mm;
        }

        .letterhead-guide,
        .footer-guide {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="letterhead-guide">Reserved for pre-printed TAT letterhead</div>
      <div class="footer-guide">Reserved for pre-printed footer</div>

      <section class="meta">
        <div>Ref. No. {{ref_no}}</div>
        <div>Date: {{date}}</div>
      </section>

      <section class="body">
        <p>To,</p>
        <p>{{hr_title}},<br />{{company}},<br />{{company_address_html}}</p>
        <p class="subject">Subject: Application for ${type} Opportunity</p>
        <p>Dear Sir/Madam,</p>
        <p class="justify">
          I am reaching out to formally request ${article} ${lower} opportunity on behalf of
          {{student_name}}, a dedicated {{year}} B. Tech student majoring in {{branch_name}}.
          {{student_name}} is currently enrolled in the academic session {{session}} at
          Trident Academy of Technology, Bhubaneswar, and holds registration number {{reg_no}}.
        </p>
        <p class="justify">
          Trident Academy of Technology is proud to be affiliated with Biju Patnaik University of
          Technology, Rourkela, Odisha, and accredited by the All India Council of Technical
          Education (AICTE), New Delhi.
        </p>
        <p class="justify">
          We kindly ask for your consideration in allowing {{student_name}} to apply for a
          ${lower} within your esteemed organization. The proposed duration for this ${lower} is
          approximately {{duration}}, starting from {{start_date_long}}.
        </p>
        <p class="justify">
          We firmly believe that ${article} ${lower} opportunity at your organization would offer
          {{student_name}} invaluable hands-on experience, perfectly aligning with academic pursuits
          and future career aspirations.
        </p>
        <p>Thank you sincerely for reviewing our request.</p>
        <div class="signature">
          <p>Yours faithfully,</p>
          <p>
            {{hod_name}},<br />
            HOD ({{branch_code}}),<br />
            Trident Academy of Technology,<br />
            Mail: {{hod_email}}<br />
            Mobile: {{hod_mobile}}
          </p>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

const branchSeed = [
  {
    code: "CSE",
    name: "Computer Science Engineering",
    hod_name: "Dr. Padmabati Chand",
    hod_email: "hodcse@tat.ac.in",
    hod_mobile: "9437961032",
    current_serial: 0,
    serial_year: 2026
  },
  {
    code: "CSE-AIML",
    name: "Computer Science and Engineering (AI & ML)",
    hod_name: "Mr. Mohini Prasad Mishra",
    hod_email: "hodcsaiml@tat.ac.in",
    hod_mobile: "7008821914",
    current_serial: 0,
    serial_year: 2026
  },
  {
    code: "ECE",
    name: "Electronics and Communication Engineering",
    hod_name: "Dr. Anindita Sahoo",
    hod_email: "hodece@tat.ac.in",
    hod_mobile: "9437000001",
    current_serial: 0,
    serial_year: 2026
  }
] as const;

const sessionSeed = [
  { value: "2022-2026", active: 1 },
  { value: "2023-2027", active: 1 },
  { value: "2024-2028", active: 1 },
  { value: "2025-2029", active: 1 }
] as const;

const companySeed = [
  {
    name: "TPCODL",
    hr_title: "Head HR",
    address: "TPCODL Corporate Office\nPower House Square\nBhubaneswar - 751001"
  },
  {
    name: "TPCODL Railvihar",
    hr_title: "Territory General Manager",
    address:
      "1st Floor, Annex Building, B Block\nRailvihar, Chandrasekharpur\nBhubaneswar, Odisha - 759147"
  }
] as const;

const durationSeed = [
  {
    id: "seed-duration-internship-1-month",
    cert_type: "Internship",
    label: "ONE MONTH",
    active: 1
  },
  {
    id: "seed-duration-internship-2-months",
    cert_type: "Internship",
    label: "TWO MONTHS",
    active: 1
  },
  {
    id: "seed-duration-apprenticeship-5-months",
    cert_type: "Apprenticeship",
    label: "FIVE MONTHS",
    active: 1
  }
] as const;

const templateSeed = [
  {
    id: "seed-template-internship-standard",
    name: "TAT Internship Standard",
    type: "Internship",
    content: buildDefaultTemplate("Internship"),
    active: 1
  },
  {
    id: "seed-template-apprenticeship-standard",
    name: "TAT Apprenticeship Standard",
    type: "Apprenticeship",
    content: buildDefaultTemplate("Apprenticeship"),
    active: 1
  }
] as const;

let initializationPromise: Promise<void> | null = null;

function seedStatements(db: D1Database): D1PreparedStatement[] {
  return [
    ...branchSeed.map((branch) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO branches
           (code, name, hod_name, hod_email, hod_mobile, current_serial, serial_year)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
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
    ),
    ...sessionSeed.map((session) =>
      db
        .prepare(`INSERT OR IGNORE INTO academic_sessions (value, active) VALUES (?, ?)`)
        .bind(session.value, session.active)
    ),
    ...companySeed.map((company) =>
      db
        .prepare(`INSERT OR IGNORE INTO companies (name, hr_title, address) VALUES (?, ?, ?)`)
        .bind(company.name, company.hr_title, company.address)
    ),
    ...durationSeed.map((duration) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO duration_policies (id, cert_type, label, active)
           VALUES (?, ?, ?, ?)`
        )
        .bind(duration.id, duration.cert_type, duration.label, duration.active)
    ),
    ...templateSeed.map((template) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO templates (id, name, type, content, active)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(template.id, template.name, template.type, template.content, template.active)
    )
  ];
}

export async function ensureDatabaseReady(db: D1Database): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await db.exec(schemaSql);
      const seedState = await db
        .prepare(`SELECT value FROM system_state WHERE key = ? LIMIT 1`)
        .bind("seed_version")
        .first<{ value: string }>();

      if (!seedState) {
        const statements = seedStatements(db);
        statements.push(
          db
            .prepare(`INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?)`)
            .bind("seed_version", "1", new Date().toISOString())
        );
        await db.batch(statements);
      }
    })();
  }

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export { buildDefaultTemplate, schemaSql };
