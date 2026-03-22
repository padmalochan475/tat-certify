-- Add application_id to legacy certificate_log for unification
ALTER TABLE certificate_log ADD COLUMN application_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cert_log_app_id ON certificate_log(application_id);
