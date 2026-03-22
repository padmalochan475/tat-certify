# Deployment Guide for Phases 2-8

## Prerequisites

Before deploying the enhanced architecture, ensure you have:

1. **Cloudflare Account** with Pages enabled
2. **Wrangler CLI** installed (`npm install -g wrangler`)
3. **Node.js** v18 or higher
4. **Git** for version control

---

## Step 1: Install Dependencies

```bash
npm install
```

This will install:
- `zod` - Schema validation
- `qrcode` - QR code generation
- TypeScript and Wrangler

---

## Step 2: Create Cloudflare Resources

### 2.1 Create D1 Database (if not exists)

```bash
# Create production database
wrangler d1 create tat-certificate-db

# Create preview database
wrangler d1 create tat-certificate-db-preview
```

Update `wrangler.toml` with the database IDs.

### 2.2 Run Migrations

```bash
# Run migrations on production
wrangler d1 migrations apply tat-certificate-db

# Run migrations on preview
wrangler d1 migrations apply tat-certificate-db-preview --local
```

### 2.3 Create R2 Bucket

```bash
# Create production bucket
wrangler r2 bucket create tat-certificates

# Create preview bucket
wrangler r2 bucket create tat-certificates-preview
```

Update `wrangler.toml` with the bucket names.

### 2.4 Create Queue

```bash
# Create certificate generation queue
wrangler queues create certificate-generation-queue

# Create dead letter queue
wrangler queues create certificate-dlq
```

### 2.5 Create KV Namespace

```bash
# Create production KV
wrangler kv:namespace create "CACHE_KV"

# Create preview KV
wrangler kv:namespace create "CACHE_KV" --preview
```

Update `wrangler.toml` with the KV namespace IDs.

---

## Step 3: Configure Environment Variables

Create `.dev.vars` file for local development:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
ADMIN_SECRET=your_secret_key_min_32_chars
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_ALLOWED_HD=tat.ac.in
```

For production, set secrets using Wrangler:

```bash
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_ALLOWED_HD
```

---

## Step 4: Update wrangler.toml

Ensure your `wrangler.toml` has all the correct bindings:

```toml
name = "tat-certificate-system"
compatibility_date = "2026-03-18"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "tat-certificate-db"
database_id = "YOUR_DATABASE_ID"
preview_database_id = "YOUR_PREVIEW_DATABASE_ID"
migrations_dir = "migrations"

[[queues.producers]]
binding = "CERTIFICATE_QUEUE"
queue = "certificate-generation-queue"

[[queues.consumers]]
queue = "certificate-generation-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "certificate-dlq"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "tat-certificates"
preview_bucket_name = "tat-certificates-preview"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_KV_ID"
preview_id = "YOUR_PREVIEW_KV_ID"
```

---

## Step 5: Test Locally

```bash
# Start local development server
npm run dev
```

This will start:
- Pages dev server on `http://localhost:8788`
- Local D1 database
- Local R2 storage
- Local queue processing

Test the following:
1. Admin login
2. Create a test application
3. Approve the application
4. Generate certificate (should queue)
5. Check certificate status
6. Verify QR code

---

## Step 6: Deploy to Production

### 6.1 Deploy Pages

```bash
# Deploy to Cloudflare Pages
npm run deploy
```

### 6.2 Deploy Worker (for Queue Consumer)

The queue consumer is automatically deployed with Pages, but you can verify:

```bash
# Check deployment status
wrangler pages deployment list
```

### 6.3 Verify Deployment

1. Visit your Pages URL (e.g., `https://tat-certify.pages.dev`)
2. Test admin login
3. Test certificate generation
4. Test QR verification
5. Check queue processing in Cloudflare dashboard

---

## Step 7: Configure Custom Domain (Optional)

### 7.1 Add Custom Domain to Pages

```bash
wrangler pages domain add tat-certify.pages.dev your-domain.com
```

### 7.2 Configure R2 Custom Domain

1. Go to Cloudflare Dashboard > R2
2. Select your bucket
3. Click "Settings" > "Public Access"
4. Add custom domain (e.g., `certificates.your-domain.com`)
5. Update PDF URLs in code to use custom domain

---

## Step 8: Monitoring and Maintenance

### 8.1 Monitor Queue Processing

```bash
# View queue metrics
wrangler queues list

# View queue messages
wrangler queues consumer <queue-name>
```

### 8.2 Monitor R2 Storage

```bash
# List R2 objects
wrangler r2 object list tat-certificates

# Check storage usage
wrangler r2 bucket info tat-certificates
```

### 8.3 Monitor D1 Database

```bash
# Check database size
wrangler d1 info tat-certificate-db

# Run queries
wrangler d1 execute tat-certificate-db --command "SELECT COUNT(*) FROM applications"
```

### 8.4 View Logs

```bash
# View Pages logs
wrangler pages deployment tail

# View Worker logs
wrangler tail
```

---

## Step 9: Backup and Recovery

### 9.1 Backup D1 Database

```bash
# Export database
wrangler d1 export tat-certificate-db --output backup.sql

# Upload to R2
wrangler r2 object put tat-certificates/backups/backup-$(date +%Y%m%d).sql --file backup.sql
```

### 9.2 Restore Database

```bash
# Download backup
wrangler r2 object get tat-certificates/backups/backup-20260320.sql --file restore.sql

# Import to database
wrangler d1 execute tat-certificate-db --file restore.sql
```

---

## Step 10: Scaling Considerations

### 10.1 Queue Configuration

If you experience high load, adjust queue settings in `wrangler.toml`:

```toml
[[queues.consumers]]
queue = "certificate-generation-queue"
max_batch_size = 20  # Increase for higher throughput
max_batch_timeout = 60  # Increase for longer processing
max_retries = 5  # Increase for better reliability
```

### 10.2 R2 Storage

R2 is automatically scaled by Cloudflare. Monitor usage:

```bash
wrangler r2 bucket info tat-certificates
```

### 10.3 D1 Database

D1 automatically scales. Monitor query performance:

```bash
wrangler d1 execute tat-certificate-db --command "EXPLAIN QUERY PLAN SELECT * FROM applications WHERE status = 'approved'"
```

---

## Troubleshooting

### Issue: Queue Not Processing

**Solution:**
1. Check queue consumer is deployed:
   ```bash
   wrangler queues consumer certificate-generation-queue
   ```
2. Check for errors in logs:
   ```bash
   wrangler tail
   ```
3. Verify queue binding in `wrangler.toml`

### Issue: R2 Upload Fails

**Solution:**
1. Check R2 bucket exists:
   ```bash
   wrangler r2 bucket list
   ```
2. Verify R2 binding in `wrangler.toml`
3. Check bucket permissions

### Issue: PDF Generation Fails

**Solution:**
1. Check QR code generation works
2. Verify template rendering
3. Check R2 upload permissions
4. Review queue consumer logs

### Issue: Serial Numbers Duplicate

**Solution:**
1. Check database transaction isolation
2. Verify atomic increment logic
3. Review `department_serials` table

---

## Performance Benchmarks

### Expected Performance

- **Certificate Generation:** 2-5 seconds (queued)
- **QR Verification:** <100ms
- **API Response Time:** <200ms
- **Queue Processing:** 10-20 certificates/minute
- **R2 Upload:** <1 second per PDF

### Quota Usage (Free Tier)

- **Requests:** ~500/day (0.5% of 100k limit)
- **D1 Reads:** ~2,000/day (0.04% of 5M limit)
- **D1 Writes:** ~1,000/day (1% of 100k limit)
- **Queue Messages:** ~100/day (0.01% of 1M limit)
- **R2 Storage:** ~100MB/year (0.002% of 10GB limit)

**Result: 100% FREE FOREVER** ✅

---

## Security Checklist

- ✅ Admin credentials stored as secrets
- ✅ HTTPS enforced on custom domain
- ✅ Input validation with Zod
- ✅ SQL injection prevention
- ✅ CSRF protection
- ⏳ Rate limiting (implement if needed)
- ⏳ Content Security Policy headers

---

## Maintenance Schedule

### Daily
- Monitor queue processing
- Check error logs
- Verify certificate generation

### Weekly
- Review audit logs
- Check storage usage
- Backup database

### Monthly
- Review performance metrics
- Update dependencies
- Security audit

---

## Support

For issues or questions:
- Check logs: `wrangler tail`
- Review documentation: `/docs`
- Check Cloudflare status: https://www.cloudflarestatus.com/

---

**Last Updated:** 2026-03-20
**Version:** 2.0
