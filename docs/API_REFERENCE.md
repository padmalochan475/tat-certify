# API Reference - Enhanced Architecture V2.0

## Base URL
```
Production: https://your-domain.pages.dev/api
Local: http://localhost:8788/api
```

## Authentication

All admin endpoints require authentication via session cookie.

### Login
```http
POST /admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

Response: 200 OK
Set-Cookie: tat_admin_session=...
{
  "authenticated": true,
  "username": "admin"
}
```

### Google Login
```http
POST /admin/google-login
Content-Type: application/json

{
  "credential": "google-jwt-token"
}

Response: 200 OK
Set-Cookie: tat_admin_session=...
{
  "authenticated": true,
  "username": "user@tat.ac.in"
}
```

### Logout
```http
POST /admin/logout

Response: 200 OK
{
  "authenticated": false
}
```

---

## Template V2 Endpoints

### Create Template
```http
POST /admin/templates-v2
Content-Type: application/json
Cookie: tat_admin_session=...

{
  "name": "TAT Internship Standard V2",
  "type": "Internship",
  "template_json": "{...}",
  "active": true
}

Response: 201 Created
{
  "id": "uuid",
  "name": "TAT Internship Standard V2",
  "type": "Internship",
  "version": 1,
  "template_json": "{...}",
  "active": true,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z",
  "created_by": "admin@tat.ac.in"
}
```

### List Templates
```http
GET /admin/templates-v2?type=Internship&active=true
Cookie: tat_admin_session=...

Response: 200 OK
[
  {
    "id": "uuid",
    "name": "TAT Internship Standard V2",
    "type": "Internship",
    "version": 1,
    "active": true,
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-03-20T10:00:00Z",
    "created_by": "admin@tat.ac.in"
  }
]
```

**Query Parameters:**
- `type` (optional): Filter by type (Internship, Apprenticeship, Custom)
- `active` (optional): Filter by active status (true, false)

### Get Template
```http
GET /admin/templates-v2/:id
Cookie: tat_admin_session=...

Response: 200 OK
{
  "id": "uuid",
  "name": "TAT Internship Standard V2",
  "type": "Internship",
  "version": 1,
  "template_json": "{...}",
  "active": true,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z",
  "created_by": "admin@tat.ac.in"
}
```

### Update Template
```http
PUT /admin/templates-v2/:id
Content-Type: application/json
Cookie: tat_admin_session=...

{
  "name": "Updated Name",
  "template_json": "{...}",
  "active": false
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Updated Name",
  "type": "Internship",
  "version": 2,
  "template_json": "{...}",
  "active": false,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T11:00:00Z",
  "created_by": "admin@tat.ac.in"
}
```

**Note:** Updating `template_json` automatically increments the version.

### Delete Template
```http
DELETE /admin/templates-v2/:id
Cookie: tat_admin_session=...

Response: 204 No Content
```

**Error:** 400 Bad Request if template is used in applications

### Clone Template
```http
POST /admin/templates-v2/:id/clone
Content-Type: application/json
Cookie: tat_admin_session=...

{
  "name": "Cloned Template Name"
}

Response: 201 Created
{
  "id": "new-uuid",
  "name": "Cloned Template Name",
  "type": "Internship",
  "version": 1,
  "template_json": "{...}",
  "active": true,
  "created_at": "2026-03-20T11:00:00Z",
  "updated_at": "2026-03-20T11:00:00Z",
  "created_by": "admin@tat.ac.in"
}
```

### Preview Template
```http
POST /admin/templates-v2/:id/preview
Content-Type: application/json
Cookie: tat_admin_session=...

{
  "context": {
    "student_name": "John Doe",
    "reg_no": "2201234567",
    "branch_name": "Computer Science Engineering",
    "branch_code": "CSE",
    "session": "2023-2027",
    "year": "Third Year",
    "company_name": "TPCODL",
    "company_hr_title": "Head HR",
    "company_address": "Bhubaneswar",
    "duration": "TWO MONTHS",
    "start_date": "2026-04-01",
    "hod_name": "Dr. Padmabati Chand",
    "hod_designation": "HOD",
    "hod_email": "hodcse@tat.ac.in",
    "hod_mobile": "9437961032",
    "serial": "1",
    "issue_date": "2026-03-20"
  }
}

Response: 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>
  <!-- Rendered HTML -->
</html>
```

### Get Template Versions
```http
GET /admin/templates-v2/:id/versions
Cookie: tat_admin_session=...

Response: 200 OK
[
  {
    "id": "version-uuid",
    "template_id": "template-uuid",
    "version": 2,
    "template_json": "{...}",
    "changes": "Template updated",
    "created_at": "2026-03-20T11:00:00Z",
    "created_by": "admin@tat.ac.in"
  },
  {
    "id": "version-uuid",
    "template_id": "template-uuid",
    "version": 1,
    "template_json": "{...}",
    "changes": "Initial version",
    "created_at": "2026-03-20T10:00:00Z",
    "created_by": "admin@tat.ac.in"
  }
]
```

---

## Application Endpoints

### Create Application
```http
POST /admin/applications
Content-Type: application/json
Cookie: tat_admin_session=...

{
  "template_id": "template-uuid",
  "student_name": "John Doe",
  "reg_no": "2201234567",
  "branch_id": "CSE",
  "form_data": {
    "year": "Third Year",
    "session": "2023-2027",
    "company": "TPCODL",
    "company_hr_title": "Head HR",
    "company_address": "Bhubaneswar",
    "duration": "TWO MONTHS",
    "start_date": "2026-04-01"
  }
}

Response: 201 Created
{
  "id": "application-uuid",
  "status": "draft"
}
```

### List Applications
```http
GET /admin/applications?status=submitted&branch=CSE
Cookie: tat_admin_session=...

Response: 200 OK
[
  {
    "id": "application-uuid",
    "template_id": "template-uuid",
    "student_name": "John Doe",
    "reg_no": "2201234567",
    "branch_id": "CSE",
    "form_data": "{...}",
    "status": "submitted",
    "submitted_at": "2026-03-20T10:00:00Z",
    "created_at": "2026-03-20T09:00:00Z",
    "updated_at": "2026-03-20T10:00:00Z"
  }
]
```

**Query Parameters:**
- `status` (optional): Filter by status (draft, submitted, approved, rejected, processing, completed, failed)
- `branch` (optional): Filter by branch code

### Get Application
```http
GET /admin/applications/:id
Cookie: tat_admin_session=...

Response: 200 OK
{
  "id": "application-uuid",
  "template_id": "template-uuid",
  "student_name": "John Doe",
  "reg_no": "2201234567",
  "branch_id": "CSE",
  "form_data": "{...}",
  "status": "submitted",
  "submitted_at": "2026-03-20T10:00:00Z",
  "created_at": "2026-03-20T09:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z"
}
```

### Update Application
```http
PUT /admin/applications/:id
Content-Type: application/json
Cookie: tat_admin_session=...

{
  "status": "approved",
  "approved_by": "admin@tat.ac.in"
}

Response: 200 OK
{
  "success": true
}
```

**Status Transitions:**
- `draft` → `submitted`
- `submitted` → `approved` or `rejected`
- `approved` → `processing`
- `processing` → `completed` or `failed`

### Delete Application
```http
DELETE /admin/applications/:id
Cookie: tat_admin_session=...

Response: 204 No Content
```

---

## Legacy Endpoints (Backward Compatibility)

### Bootstrap (Student Portal)
```http
GET /bootstrap/student

Response: 200 OK
{
  "branches": [...],
  "sessions": [...],
  "companies": [...],
  "durations": [...],
  "templates": [...]
}
```

### Bootstrap (Admin Panel)
```http
GET /admin/bootstrap
Cookie: tat_admin_session=...

Response: 200 OK
{
  "branches": [...],
  "sessions": [...],
  "companies": [...],
  "durations": [...],
  "templates": [...],
  "students": [...],
  "adminUsers": [...],
  "certificateLog": [...]
}
```

### Master Data CRUD
```http
POST   /admin/branches
DELETE /admin/branches/:code

POST   /admin/companies
DELETE /admin/companies/:name

POST   /admin/sessions
DELETE /admin/sessions/:value

POST   /admin/durations
DELETE /admin/durations/:id
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Validation failed",
  "issues": [
    "Field 'name' is required",
    "Field 'type' must be one of: Internship, Apprenticeship, Custom"
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "message": "Google sign-in request is awaiting admin approval"
}
```

### 404 Not Found
```json
{
  "message": "Template not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

---

## Rate Limits

**Cloudflare Free Tier:**
- 100,000 requests/day
- No per-IP rate limiting implemented yet

**Recommended Client-Side:**
- Max 10 requests/second
- Implement exponential backoff for retries

---

## Webhooks (Future)

Not yet implemented. Planned for Phase 3.

---

## Changelog

### v2.0.0 (2026-03-20)
- ✅ Added Template V2 endpoints (JSON-driven)
- ✅ Added Application endpoints
- ✅ Added template versioning
- ✅ Added template cloning
- ✅ Added template preview
- ✅ Backward compatible with v1 endpoints

### v1.0.0 (Initial)
- Legacy endpoints for students, templates, certificates

---

## Support

For API issues or questions:
1. Check [`docs/PHASE1_IMPLEMENTATION.md`](./PHASE1_IMPLEMENTATION.md)
2. Review [`plans/enhanced-architecture-v2.md`](../plans/enhanced-architecture-v2.md)
3. Test with Postman collection (coming soon)
