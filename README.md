# TAT Certificate System

Dynamic certificate request and generation system for Trident Academy of Technology, prepared for free deployment on GitHub + Cloudflare Pages + D1.

## What is included

- Separate landing page, student form page, and admin login page
- Student request flow with dynamic company selection or manual company entry
- Admin-managed branches, HOD details, department serial starts, company directory, academic sessions, duration options, and templates
- Approval flow that stores approved new companies for future student dropdown use
- Admin-selected issue date for certificate generation, including backdated generation
- Template-driven certificate generation for internship and apprenticeship letters
- One-page content-only certificate layout reserved for pre-printed TAT letterhead
- Reference number engine in the format `TAT/{BRANCH}/{SERIAL}/{YEAR}`
- Academic year engine
- Certificate log tracking
- Cloudflare D1-backed CRUD architecture with strict validation

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

3. Start the Pages dev server:

```bash
npm run dev
```

The site runs through `wrangler pages dev`, which serves the static assets in `public/` and the API Functions in `functions/`.

Default admin login for local development:

- Username: `admin`
- Password: `tatadmin123`

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
- Wrangler config: [wrangler.toml](D:/Projects/Internship-Projects/wrangler.toml)
- Landing page: [public/index.html](D:/Projects/Internship-Projects/public/index.html)
- Student page: [public/student.html](D:/Projects/Internship-Projects/public/student.html)
- Admin page: [public/admin.html](D:/Projects/Internship-Projects/public/admin.html)
