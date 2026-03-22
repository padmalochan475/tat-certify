# Deployment Guide - Enhanced Architecture V2.0

## Prerequisites

- Node.js 18+ installed
- Cloudflare account (free tier is sufficient)
- Wrangler CLI installed (`npm install -g wrangler`)
- Git repository

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd Internship-Projects
npm install
```

### 2. Configure Environment

Create `.dev.vars` file (copy from `.dev.vars.example`):

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
ADMIN_SECRET=your-secret-key-min-32-chars
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_HD=tat.ac.in
```

### 3. Create Local D1 Database

```bash
# Create local database
wrangler d1 create tat-certificate-db --local

# Apply migrations
wrangler d1 migrations apply DB --local
```

### 4. Start Development Server

```bash
npm run dev
```

Visit: `http://localhost:8788`

---

## Production Deployment

### 1. Create Cloudflare D1 Database

```bash
# Create production database
wrangler d1 create tat-certificate-db

# Note the database_id from output
# Update wrangler.toml with the database_id
```

Update [`wrangler.toml`](../wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "tat-certificate-db"
database_id = "your-database-id-here"
```

### 2. Apply Migrations

```bash
# Apply all migrations to production
wrangler d1 migrations apply DB --remote
```

Verify migrations:

```bash
wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 3. Set Production Secrets

```bash
# Set admin credentials
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_SECRET

# Set Google OAuth (optional)
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_ALLOWED_HD
```

### 4. Deploy to Cloudflare Pages

```bash
# Deploy
npm run deploy

# Or use Wrangler
wrangler pages deploy public
```

### 5. Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Click "Custom domains"
3. Add your domain (e.g., `certificates.tat.ac.in`)
4. Update DNS records as instructed

---

## Database Seeding

### Seed Default Data

The system automatically seeds default data on first run:

- **Branches:** CSE, CSE-AIML, ECE
- **Sessions:** 2022-2026, 2023-2027, 2024-2028, 2025-2029
- **Companies:** TPCODL, TPCODL Railvihar
- **Durations:** 1 month, 2 months, 5 months
- **Templates:** Internship Standard, Apprenticeship Standard (legacy)

### Seed V2 Templates

Use the API to create V2 templates:

```bash
# Get admin session token first
curl -X POST https://your-domain.pages.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Create Internship template
curl -X POST https://your-domain.pages.dev/api/admin/templates-v2 \
  -H "Content-Type: application/json" \
  -H "Cookie: tat_admin_session=YOUR_SESSION_TOKEN" \
  -d @src/templates/internship-standard-v2.json

# Create Apprenticeship template
curl -X POST https://your-domain.pages.dev/api/admin/templates-v2 \
  -H "Content-Type: application/json" \
  -H "Cookie: tat_admin_session=YOUR_SESSION_TOKEN" \
  -d @src/templates/apprenticeship-standard-v2.json
```

---

## Monitoring & Debugging

### View Logs

```bash
# Tail production logs
wrangler tail

# Filter by status
wrangler tail --status error
```

### Query Database

```bash
# Execute SQL query
wrangler d1 execute DB --remote --command "SELECT * FROM templates_v2"

# Export data
wrangler d1 export DB --remote --output backup.sql
```

### Check Metrics

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your project
3. View Analytics tab for:
   - Request count
   - Error rate
   - Response time
   - Bandwidth usage

---

## Backup & Restore

### Backup Database

```bash
# Export database
wrangler d1 export DB --remote --output backup-$(date +%Y%m%d).sql

# Store in R2 (future)
# wrangler r2 object put backups/backup-$(date +%Y%m%d).sql --file backup-$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Import from backup
wrangler d1 execute DB --remote --file backup-20260320.sql
```

---

## Scaling Considerations

### Cloudflare Free Tier Limits

| Resource | Free Tier Limit | Usage Strategy |
|----------|----------------|----------------|
| D1 Reads | 5M/day | Cache templates in KV |
| D1 Writes | 100K/day | Batch operations |
| Workers Requests | 100K/day | Optimize endpoints |
| KV Reads | 100K/day | Cache master data |
| KV Writes | 1K/day | Update only on changes |
| R2 Storage | 10GB | Compress PDFs |

### Optimization Tips

1. **Cache Templates in KV**
   ```typescript
   // Check KV first, fallback to D1
   let template = await env.KV.get(`template:${id}`);
   if (!template) {
     template = await db.getTemplate(id);
     await env.KV.put(`template:${id}`, JSON.stringify(template), {
       expirationTtl: 3600 // 1 hour
     });
   }
   ```

2. **Batch Database Operations**
   ```typescript
   // Instead of multiple queries
   await db.batch([
     db.prepare("INSERT INTO ..."),
     db.prepare("INSERT INTO ..."),
     db.prepare("INSERT INTO ...")
   ]);
   ```

3. **Use Indexes**
   - Already created in migration 0003
   - Monitor slow queries with `EXPLAIN QUERY PLAN`

4. **Lazy Load Data**
   - Don't load all applications at once
   - Implement pagination
   - Use filters effectively

---

## Security Checklist

- [x] Admin authentication required
- [x] Secrets stored in Wrangler secrets (not in code)
- [x] SQL injection prevention (prepared statements)
- [x] Input validation with Zod
- [x] Audit logging enabled
- [ ] Rate limiting (TODO)
- [ ] CSRF protection (TODO)
- [ ] Content Security Policy (TODO)

---

## Troubleshooting

### Issue: Migration fails

**Solution:**
```bash
# Check current migration status
wrangler d1 migrations list DB --remote

# Force apply specific migration
wrangler d1 execute DB --remote --file migrations/0003_enhanced_architecture_v2.sql
```

### Issue: "Template not found" error

**Solution:**
```bash
# Check if templates exist
wrangler d1 execute DB --remote --command "SELECT id, name FROM templates_v2"

# Create templates via API (see Seeding section)
```

### Issue: Authentication fails

**Solution:**
```bash
# Verify secrets are set
wrangler secret list

# Re-set secrets if needed
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
wrangler secret put ADMIN_SECRET
```

### Issue: Database connection timeout

**Solution:**
- Check D1 database is created and bound correctly
- Verify `wrangler.toml` has correct `database_id`
- Ensure migrations are applied

---

## Rollback Procedure

### Rollback Code

```bash
# Revert to previous deployment
git revert HEAD
git push

# Or rollback in Cloudflare Dashboard
# Pages → Deployments → Select previous deployment → Rollback
```

### Rollback Database

```bash
# Restore from backup
wrangler d1 execute DB --remote --file backup-previous.sql

# Or manually revert specific changes
wrangler d1 execute DB --remote --command "DROP TABLE templates_v2"
```

---

## Performance Benchmarks

### Expected Response Times

| Endpoint | Target | Actual |
|----------|--------|--------|
| GET /api/admin/templates-v2 | <100ms | TBD |
| POST /api/admin/templates-v2 | <200ms | TBD |
| POST /api/admin/templates-v2/:id/preview | <300ms | TBD |
| GET /api/bootstrap/student | <150ms | TBD |

### Load Testing

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io

# Run load test
k6 run tests/load-test.js
```

---

## CI/CD Pipeline (Future)

### GitHub Actions Example

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: wrangler pages deploy public
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Support & Maintenance

### Regular Tasks

- **Daily:** Monitor error logs
- **Weekly:** Review audit logs, check quota usage
- **Monthly:** Backup database, review performance metrics
- **Quarterly:** Update dependencies, security audit

### Contact

For deployment issues:
1. Check logs: `wrangler tail`
2. Review documentation
3. Contact Cloudflare support (if needed)

---

**Last Updated:** 2026-03-20  
**Version:** 2.0.0
