/**
 * Queue Consumer Worker
 * Processes certificate generation jobs from the queue
 */

import { getAcademicYear } from '../engines/academicYear';
import { renderTemplate } from '../services/templateEngine';
import { generateQRCode, generatePDF, uploadToR2 } from '../services/pdfService';

export interface CertificateJob {
  application_id: string;
  template_id: string;
  issue_date: string;
  timestamp: number;
}

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  CERTIFICATE_QUEUE: Queue<CertificateJob>;
}

/**
 * Queue consumer handler
 */
export async function handleQueue(batch: MessageBatch<CertificateJob>, env: Env): Promise<void> {
  console.log(`Processing batch of ${batch.messages.length} certificate jobs`);

  for (const message of batch.messages) {
    try {
      await processCertificate(message.body, env);
      message.ack();
      console.log(`Successfully processed certificate job: ${message.body.application_id}`);
    } catch (error) {
      console.error(`Failed to process certificate job: ${message.body.application_id}`, error);
      
      // Retry with exponential backoff
      if (message.attempts < 3) {
        message.retry({ delaySeconds: Math.pow(2, message.attempts) * 10 });
      } else {
        // Max retries reached, mark as failed
        await markApplicationFailed(message.body.application_id, error, env);
        message.ack(); // Acknowledge to remove from queue
      }
    }
  }
}

/**
 * Process a single certificate generation job
 */
async function processCertificate(job: CertificateJob, env: Env): Promise<void> {
  const { application_id, template_id, issue_date } = job;

  // 1. Fetch application data
  const application = await env.DB.prepare(
    'SELECT * FROM applications WHERE id = ?'
  ).bind(application_id).first<any>();

  if (!application) {
    throw new Error(`Application not found: ${application_id}`);
  }

  if (application.status !== 'approved' && application.status !== 'processing') {
    throw new Error(`Application not in valid state: ${application.status}`);
  }

  // 2. Fetch template (Check both tables for compatibility)
  let template = await env.DB.prepare(
    'SELECT * FROM templates_v2 WHERE id = ? AND active = 1'
  ).bind(template_id).first<any>();

  if (!template) {
    // Fallback to legacy templates if not found in V2
    template = await env.DB.prepare(
      'SELECT id, name, type, active, content as template_json FROM templates WHERE id = ? AND active = 1'
    ).bind(template_id).first<any>();
  }

  if (!template) {
    throw new Error(`Template not found or inactive: ${template_id}`);
  }

  // Parse template JSON (handle both V2 and Legacy formats)
  let templateData: any;
  try {
    templateData = typeof template.template_json === 'string' 
      ? JSON.parse(template.template_json) 
      : template.template_json;
    
    // Legacy templates wrap content as-is, V2 templates are structured JSON
    if (typeof templateData === 'string') {
      // Legacy content
      templateData = {
        sections: { 
          body: { paragraphs: [templateData] } 
        }
      };
    }
  } catch (e) {
    // If it's not JSON, treat it as legacy raw string content
    templateData = {
      sections: { 
        body: { paragraphs: [template.template_json] } 
      }
    };
  }

  // 3. Fetch branch data
  const branch = await env.DB.prepare(
    'SELECT * FROM branches WHERE code = ?'
  ).bind(application.branch_id).first<any>();

  if (!branch) {
    throw new Error(`Branch not found: ${application.branch_id}`);
  }

  // 4. Get next serial number (atomic operation)
  const year = new Date(issue_date).getFullYear();
  const serial = await getNextSerial(application.branch_id, year, env);

  // 5. Generate reference number
  const prefix = branch.prefix || branch.code;
  const ref_no = `TAT/${prefix}/${serial}/${year}`;

  // 6. Parse form data
  const formData = JSON.parse(application.form_data);

  // 7. Prepare template variables
  const variables = {
    ...formData,
    student_name: application.student_name,
    reg_no: application.reg_no,
    branch_name: branch.name,
    branch_code: branch.code,
    hod_name: branch.hod_name,
    hod_designation: branch.hod_designation,
    hod_email: branch.hod_email,
    hod_mobile: branch.hod_mobile,
    ref_no,
    serial: serial.toString(),
    year: year.toString(),
    issue_date: new Date(issue_date).toLocaleDateString('en-GB', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    }),
    academic_year: getAcademicYear(issue_date),
  };

  // 8. Render template to HTML
  const html = renderTemplate(templateData, variables);

  // 9. Generate QR code
  let qrCode: string | null = null;
  if (templateData.qr_settings?.enabled) {
    const verifyUrl = `https://tat-certify.pages.dev/verify/${application_id}`;
    qrCode = await generateQRCode(verifyUrl);
  }

  // 10. Generate PDF
  const pdfBuffer = await generatePDF({
    html,
    qrCode,
    qrSettings: templateData.qr_settings,
  });

  // 11. Upload to R2
  const pdfKey = `certificates/${ref_no.replace(/\//g, '-')}.pdf`;
  const pdfUrl = await uploadToR2(env.R2_BUCKET, pdfKey, pdfBuffer, {
    application_id,
    template_id,
    ref_no,
    issue_date,
    generated_at: new Date().toISOString(),
  });

  // 12. Update application status
  await env.DB.prepare(
    `UPDATE applications 
     SET status = 'completed', 
         updated_at = ?
     WHERE id = ?`
  ).bind(new Date().toISOString(), application_id).run();

  // 13. Log certificate (Unified log)
  await env.DB.prepare(
    `INSERT INTO certificate_log (
      ref_no, application_id, template_id, version, pdf_url, 
      generated_on, academic_year, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ref_no) DO UPDATE SET
      pdf_url = excluded.pdf_url,
      generated_on = excluded.generated_on,
      created_at = excluded.created_at`
  ).bind(
    ref_no,
    application_id,
    template_id,
    1,
    pdfUrl,
    issue_date,
    getAcademicYear(issue_date),
    new Date().toISOString()
  ).run();

  // 14. Audit log
  await env.DB.prepare(
    `INSERT INTO audit_log (
      id, actor_email, actor_method, action, target_type, target_id, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    'system',
    'Queue',
    'certificate_generated',
    'application',
    application_id,
    JSON.stringify({ ref_no, pdf_url: pdfUrl }),
    new Date().toISOString()
  ).run();

  console.log(`Certificate generated successfully: ${ref_no}`);
}

/**
 * Get next serial number for branch and year (atomic using UPSERT)
 */
async function getNextSerial(branchId: string, year: number, env: Env): Promise<number> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Use a single statement with RETURNING to ensure atomicity in D1
  const result = await env.DB.prepare(
    `INSERT INTO department_serials (id, branch_id, year, current_serial, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(branch_id, year) DO UPDATE SET
       current_serial = current_serial + 1,
       updated_at = excluded.updated_at
     RETURNING current_serial`
  ).bind(id, branchId, year, now).first();

  if (!result || typeof result !== 'object') {
    throw new Error('Failed to increment serial number');
  }

  return (result as any).current_serial;
}

/**
 * Mark application as failed
 */
async function markApplicationFailed(applicationId: string, error: any, env: Env): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  await env.DB.prepare(
    `UPDATE applications 
     SET status = 'failed', 
         updated_at = ?
     WHERE id = ?`
  ).bind(new Date().toISOString(), applicationId).run();

  // Log failure
  await env.DB.prepare(
    `INSERT INTO audit_log (
      id, actor_email, actor_method, action, target_type, target_id, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    'system',
    'Queue',
    'certificate_generation_failed',
    'application',
    applicationId,
    JSON.stringify({ error: errorMessage }),
    new Date().toISOString()
  ).run();

  console.error(`Certificate generation failed for application ${applicationId}: ${errorMessage}`);
}
