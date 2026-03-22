# TAT Certificate System - Enhanced Architecture V2.0

**Production-grade, enterprise-level, JSON-driven certificate automation platform** for Trident Academy of Technology.

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange)](https://pages.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 🎯 Vision

Transform certificate generation into a **fully dynamic, no-code/low-code SaaS platform** where everything is configurable through JSON templates.

## ✨ What's New in V2.0

### 🚀 JSON-Driven Templates
- **No hardcoding** - All templates stored as JSON
- **Dynamic forms** - Auto-generated from template configuration
- **Conditional logic** - Show/hide content based on data
- **Version control** - Full template history with rollback

### 📋 Application Management
- **Workflow states** - draft → submitted → approved → processing → completed
- **Status tracking** - Real-time application status
- **Audit trail** - Complete history of all changes

### 🔧 Full CRUD Operations
- Templates, Applications, Branches, Companies, Sessions, Durations
- Branch contacts for signature collection
- Department-wise serial number management

### 🎨 Template Features
- Dynamic placeholder replacement (`{{variable}}`)
- Conditional paragraphs (`if/then` logic)
- QR code positioning (4 positions, configurable size)
- Header modes (with/without letterhead)
- Form field validation (min, max, pattern, email, phone, date)
- Field types: text, textarea, dropdown, date, email, phone, number

## 📚 Documentation

- **[Phase 1 Implementation Guide](docs/PHASE1_IMPLEMENTATION.md)** - Complete implementation details
- **[API Reference](docs/API_REFERENCE.md)** - All API endpoints with examples
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment steps
- **[Architecture Design](plans/enhanced-architecture-v2.md)** - Complete system architecture

## 🏗️ Architecture

### Core Components

1. **Template Engine** ([`src/services/templateEngine.ts`](src/services/templateEngine.ts))
   - Renders JSON templates to HTML
   - Placeholder replacement
   - Conditional logic evaluation
   - Form validation

2. **Template Service** ([`src/services/templateService.ts`](src/services/templateService.ts))
   - CRUD operations for templates
   - Version management
   - Template cloning
   - Usage validation

3. **API Layer** ([`functions/api/[[path]].ts`](functions/api/[[path]].ts))
   - RESTful endpoints
   - Authentication & authorization
   - Input validation with Zod
   - Audit logging

4. **Database Layer** (Cloudflare D1)
   - Templates, Applications, Certificates
   - Master data (Branches, Companies, etc.)
   - Audit logs, Version history

## 🎯 Features

### For Students
- Select certificate type (Internship/Apprenticeship)
- Dynamic form based on template
- Real-time validation
- Application status tracking
- Certificate download

### For Admins
- Template management (create, edit, clone, preview)
- Application approval workflow
- Master data management
- Certificate generation
- Audit log viewing
- Branch contact management

### For Developers
- Type-safe TypeScript
- Zod schema validation
- RESTful API
- JSON-driven configuration
- Version control
- Extensible architecture

## Stack

- Cloudflare Pages Functions
- Cloudflare D1
- TypeScript
- Vanilla HTML, CSS, and JavaScript frontend

## Routes

- `/` landing page
- `/student` student request form
- `/admin` admin login and dashboard

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy the local env template:

```bash
copy .dev.vars.example .dev.vars
```

3. Edit `.dev.vars` and set your own local admin credentials and secret.
   Optional backend values:
   - `GOOGLE_CLIENT_ID` for Google Sign-In
   - `GOOGLE_ALLOWED_HD=tat.ac.in` to restrict Google login to your Workspace domain

4. Start the Pages dev server:

```bash
npm run dev
```

The site runs through `wrangler pages dev`, which serves the static assets in `public/` and the API Functions in `functions/`.

## Cloudflare D1 setup

1. Log in to Cloudflare:

```bash
npx wrangler login
```

2. Create a production D1 database:

```bash
npx wrangler d1 create tat-certificate-db
```

3. Create a preview D1 database for branch previews:

```bash
npx wrangler d1 create tat-certificate-db-preview
```

4. Copy the production `database_id` into `database_id` in [wrangler.toml](D:/Projects/Internship-Projects/wrangler.toml), and copy the preview database `database_id` into `preview_database_id`.

5. Apply the initial schema:

```bash
npx wrangler d1 migrations apply tat-certificate-db --local
npx wrangler d1 migrations apply tat-certificate-db --remote
npx wrangler d1 migrations apply tat-certificate-db-preview --remote
```

The app also auto-creates missing tables and seeds default master data on first API use, but the migration is the correct production setup.

## GitHub -> Cloudflare deployment

1. Create the Pages project:

```bash
npx wrangler pages project create tat-certify --production-branch main
```

2. Create the first deployment:

```bash
npx wrangler pages deploy public --project-name tat-certify --branch main
```

3. In Cloudflare Pages, add the D1 binding named `DB` to the `tat-certify` project.
4. Add production environment variables:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `ADMIN_SECRET`
   - `GOOGLE_CLIENT_ID` (optional)
   - `GOOGLE_ALLOWED_HD` (optional, defaults to `tat.ac.in`)
5. In GitHub repository settings, add Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
6. Push to `main` and GitHub Actions will deploy automatically using [deploy-pages.yml](D:/Projects/Internship-Projects/.github/workflows/deploy-pages.yml).

Expected public URLs:

- `https://your-project.pages.dev/`
- `https://your-project.pages.dev/student`
- `https://your-project.pages.dev/admin`

## Useful commands

```bash
npm run check
npm run dev
npm run deploy
npx wrangler pages deploy public --project-name tat-certify --branch main
```

## Important paths

- Pages API router: [functions/api/[[path]].ts](D:/Projects/Internship-Projects/functions/api/[[path]].ts)
- D1 schema and seed logic: [src/database.ts](D:/Projects/Internship-Projects/src/database.ts)
- Certificate engine: [src/services/certificateService.ts](D:/Projects/Internship-Projects/src/services/certificateService.ts)
- D1 migration: [migrations/0001_initial.sql](D:/Projects/Internship-Projects/migrations/0001_initial.sql)
- D1 migration: [migrations/0002_admin_auth_and_audit.sql](D:/Projects/Internship-Projects/migrations/0002_admin_auth_and_audit.sql)
- Wrangler config: [wrangler.toml](D:/Projects/Internship-Projects/wrangler.toml)
- Landing page: [public/index.html](D:/Projects/Internship-Projects/public/index.html)
- Student page: [public/student.html](D:/Projects/Internship-Projects/public/student.html)
- Admin page: [public/admin.html](D:/Projects/Internship-Projects/public/admin.html)
