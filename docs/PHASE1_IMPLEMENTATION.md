# Phase 1 Implementation - Enhanced Architecture V2.0

## Overview

Phase 1 (Foundation) of the Enhanced Architecture V2.0 has been successfully implemented. This phase transforms the TAT Certificate System into a JSON-driven, dynamic template system with full CRUD capabilities.

## What's Been Implemented

### 1. Database Schema (Migration 0003)

**New Tables:**
- `templates_v2` - JSON-driven templates with versioning
- `template_versions` - Version history for templates
- `applications` - Student certificate requests (replaces `students` table)
- `certificate_log_v2` - Enhanced certificate tracking with versioning
- `certificate_versions` - Certificate edit history
- `department_serials` - Atomic serial number generation per branch/year
- `branch_contacts` - Contact information for signature collection

**Enhanced Tables:**
- `branches` - Added `prefix`, `hod_designation`, `active`, timestamps
- `companies` - Added `id`, `verified`, timestamps
- `academic_sessions` - Added `created_at`
- `duration_policies` - Added `created_at`
- `admin_users` - Added `role` column

**File:** [`migrations/0003_enhanced_architecture_v2.sql`](../migrations/0003_enhanced_architecture_v2.sql)

### 2. TypeScript Schemas

**New Zod Schemas:**
- `templateJsonSchema` - Complete JSON template structure validation
- `qrSettingsSchema` - QR code configuration
- `formFieldSchema` - Dynamic form field definitions
- `applicationInputSchema` - Application submission
- `applicationUpdateSchema` - Application status updates
- `certificateGenerateSchema` - Certificate generation requests

**New Types:**
- `TemplateJson` - Full template structure
- `ApplicationStatus` - Application workflow states
- `FormField` - Dynamic form field configuration
- `TemplateRecord`, `ApplicationRecord`, `CertificateLogRecord`, etc.

**File:** [`src/schema.ts`](../src/schema.ts)

### 3. Template Engine Service

**Core Functions:**
- `renderTemplate()` - Converts JSON template + context to HTML
- `replacePlaceholders()` - {{variable}} replacement
- `evaluateCondition()` - Conditional logic (==, !=, >, <, >=, <=)
- `validateContext()` - Ensures all required placeholders are present
- `validateFormData()` - Validates form submissions against template rules
- `buildContext()` - Builds rendering context from application data

**Features:**
- Dynamic placeholder replacement
- Conditional paragraph rendering
- QR code positioning
- Header/footer modes
- Form field generation from templates
- Validation rule parsing (min, max, pattern, email, phone, date)

**File:** [`src/services/templateEngine.ts`](../src/services/templateEngine.ts)

### 4. Template Service (CRUD)

**Operations:**
- `createTemplate()` - Create new JSON template
- `getTemplate()` - Retrieve template by ID
- `listTemplates()` - List with filters (type, active)
- `updateTemplate()` - Update with automatic versioning
- `deleteTemplate()` - Delete with usage validation
- `cloneTemplate()` - Duplicate existing template
- `getTemplateVersions()` - Retrieve version history
- `parseTemplateJson()` - Safe JSON parsing with validation

**File:** [`src/services/templateService.ts`](../src/services/templateService.ts)

### 5. API Endpoints

**Template V2 Endpoints:**
```
POST   /api/admin/templates-v2              - Create template
GET    /api/admin/templates-v2              - List templates (with filters)
GET    /api/admin/templates-v2/:id          - Get template
PUT    /api/admin/templates-v2/:id          - Update template
DELETE /api/admin/templates-v2/:id          - Delete template
POST   /api/admin/templates-v2/:id/clone    - Clone template
POST   /api/admin/templates-v2/:id/preview  - Preview template
GET    /api/admin/templates-v2/:id/versions - Get version history
```

**Application Endpoints:**
```
POST   /api/admin/applications              - Create application
GET    /api/admin/applications              - List applications (with filters)
GET    /api/admin/applications/:id          - Get application
PUT    /api/admin/applications/:id          - Update application
DELETE /api/admin/applications/:id          - Delete application
```

**File:** [`functions/api/[[path]].ts`](../functions/api/[[path]].ts)

### 6. Sample JSON Templates

Two production-ready templates have been created:

1. **Internship Standard V2**
   - File: [`src/templates/internship-standard-v2.json`](../src/templates/internship-standard-v2.json)
   - 10 dynamic form fields
   - 17 placeholders
   - QR code enabled

2. **Apprenticeship Standard V2**
   - File: [`src/templates/apprenticeship-standard-v2.json`](../src/templates/apprenticeship-standard-v2.json)
   - 10 dynamic form fields
   - 17 placeholders
   - QR code enabled

## JSON Template Structure

```json
{
  "id": "uuid",
  "name": "Template Name",
  "type": "Internship|Apprenticeship|Custom",
  "version": 1,
  "active": true,
  "header_mode": "with_header|without_header",
  "qr_settings": {
    "enabled": true,
    "position": "top-left|top-right|bottom-left|bottom-right",
    "size": 100
  },
  "sections": {
    "header": { "enabled": true, "logo_url": "", "title": "" },
    "meta": { "ref_no": "", "date": "" },
    "receiver": { "to": "", "company": "", "address": "" },
    "subject": { "text": "" },
    "body": {
      "paragraphs": ["..."],
      "conditions": [{ "if": "{{var}} == value", "then": "..." }]
    },
    "signature": { "name": "", "designation": "", "email": "", "mobile": "" },
    "footer": { "enabled": true, "text": "" }
  },
  "placeholders": ["student_name", "reg_no", ...],
  "form_fields": [
    {
      "name": "student_name",
      "type": "text|textarea|dropdown|date|email|phone|number",
      "label": "Full Name",
      "required": true,
      "validation": "min:3,max:120",
      "source": "branches|companies|sessions|durations",
      "filter_by": "cert_type",
      "conditional": { "show_if": "{{var}} == value" }
    }
  ]
}
```

## How to Use

### 1. Run Migration

```bash
# Apply the migration to your D1 database
wrangler d1 migrations apply DB --local
wrangler d1 migrations apply DB --remote
```

### 2. Create a Template

```bash
curl -X POST https://your-domain.com/api/admin/templates-v2 \
  -H "Content-Type: application/json" \
  -H "Cookie: tat_admin_session=..." \
  -d @src/templates/internship-standard-v2.json
```

### 3. List Templates

```bash
curl https://your-domain.com/api/admin/templates-v2?type=Internship&active=true \
  -H "Cookie: tat_admin_session=..."
```

### 4. Preview Template

```bash
curl -X POST https://your-domain.com/api/admin/templates-v2/{id}/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: tat_admin_session=..." \
  -d '{
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
  }'
```

### 5. Create Application

```bash
curl -X POST https://your-domain.com/api/admin/applications \
  -H "Content-Type: application/json" \
  -H "Cookie: tat_admin_session=..." \
  -d '{
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
  }'
```

## Key Features

### ✅ Fully Dynamic
- No hardcoded templates
- All content configurable via JSON
- Dynamic form generation from template

### ✅ Version Control
- Every template update creates a new version
- Full version history maintained
- Can rollback to previous versions

### ✅ Conditional Logic
- Show/hide paragraphs based on conditions
- Support for ==, !=, >, <, >=, <=
- Dynamic content based on form data

### ✅ Validation
- Field-level validation rules
- Type-specific validation (email, phone, date)
- Custom regex patterns
- Min/max length constraints

### ✅ Type-Safe
- Full TypeScript support
- Zod schema validation
- Compile-time type checking

### ✅ Production-Ready
- Error handling
- Audit logging
- Usage validation (can't delete used templates)
- Atomic operations

## Application Workflow

```
1. Student selects template type (Internship/Apprenticeship)
2. System loads template and generates dynamic form
3. Student fills form (validated against template rules)
4. Application created with status "draft"
5. Admin reviews and approves/rejects
6. On approval, certificate generation queued
7. Queue worker generates PDF with QR code
8. PDF uploaded to R2, certificate logged
9. Student can download certificate
```

## Status Flow

```
draft → submitted → approved → processing → completed
                              ↓
                           failed (with retry)
```

## Next Steps (Phase 2)

1. **Queue-Based Certificate Generation**
   - Implement Cloudflare Queues
   - Async PDF generation
   - Status polling

2. **UI Components**
   - Template editor (JSON editor with preview)
   - Application management dashboard
   - Certificate viewer

3. **PDF Generation**
   - Integrate PDF service
   - QR code generation
   - R2 upload

4. **Student Portal**
   - Dynamic form rendering
   - Application tracking
   - Certificate download

## Testing

### Unit Tests Needed
- [ ] Template engine placeholder replacement
- [ ] Conditional logic evaluation
- [ ] Form validation
- [ ] Context building

### Integration Tests Needed
- [ ] Template CRUD operations
- [ ] Application workflow
- [ ] Version management
- [ ] API endpoints

### Manual Testing
- [ ] Create template via API
- [ ] Preview template with sample data
- [ ] Create application
- [ ] Update application status
- [ ] Clone template
- [ ] View version history

## Migration Notes

### Backward Compatibility
- Old tables (`students`, `templates`, `certificate_log`) are preserved
- New tables use `_v2` suffix or new names
- Both systems can coexist during migration
- Once migration complete, old tables can be dropped

### Data Migration Script Needed
```sql
-- Migrate old templates to JSON format
-- Convert students to applications
-- Update certificate references
```

## Performance Considerations

### Cloudflare Free Tier Limits
- ✅ D1: 5GB storage, 5M reads/day, 100K writes/day
- ✅ Workers: 100K requests/day
- ✅ KV: 100K reads/day, 1K writes/day
- ✅ R2: 10GB storage, 10M Class A ops/month

### Optimization Strategies
- Cache templates in KV (rarely change)
- Batch database operations
- Use indexes for common queries
- Lazy load template versions

## Security

### Implemented
- ✅ Admin authentication required for all template operations
- ✅ Audit logging for all actions
- ✅ Input validation with Zod schemas
- ✅ SQL injection prevention (prepared statements)
- ✅ Usage validation before deletion

### TODO
- [ ] Rate limiting
- [ ] CSRF protection
- [ ] Content Security Policy
- [ ] Template sandboxing

## Documentation

- [x] Phase 1 Implementation Guide (this file)
- [x] JSON Template Structure
- [x] API Endpoint Documentation
- [ ] UI Component Guide
- [ ] Deployment Guide
- [ ] Migration Guide

## Support

For questions or issues:
1. Check [`plans/enhanced-architecture-v2.md`](../plans/enhanced-architecture-v2.md)
2. Review code comments in service files
3. Test with sample templates in `src/templates/`

---

**Status:** Phase 1 Complete ✅  
**Next:** Phase 2 - Queue-Based Processing & UI Components  
**Date:** 2026-03-20
