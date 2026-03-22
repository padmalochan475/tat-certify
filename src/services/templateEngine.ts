/**
 * Template Engine Service
 * Renders JSON-driven templates with dynamic placeholder replacement
 * and conditional logic evaluation
 */

import type { TemplateJson } from "../schema";

export interface TemplateContext {
  [key: string]: any;
}

/**
 * Main template rendering function
 * Converts JSON template + context data into HTML string
 */
export function renderTemplate(
  template: TemplateJson,
  context: TemplateContext
): string {
  const sections = template.sections;
  
  // Guard for templates that don't use sections yet (legacy or format_html only)
  if (!sections && template.format_html) {
    return `<!DOCTYPE html><html><body>${replacePlaceholders(template.format_html, context)}</body></html>`;
  }

  if (!sections) {
    return "<!-- Empty Template -->";
  }

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      margin: 0;
      padding: 40px;
      line-height: 1.6;
    }
    .certificate-container {
      max-width: 800px;
      margin: 0 auto;
      position: relative;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    .header img {
      max-width: 150px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 10px 0;
      font-size: 24px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .receiver {
      margin-bottom: 20px;
    }
    .receiver div {
      margin-bottom: 5px;
    }
    .subject {
      margin: 20px 0;
      font-weight: bold;
      text-decoration: underline;
    }
    .body {
      text-align: justify;
      margin: 20px 0;
    }
    .body p {
      margin-bottom: 15px;
    }
    .signature {
      margin-top: 40px;
      float: right;
      text-align: center;
    }
    .signature div {
      margin-bottom: 5px;
    }
    .footer {
      clear: both;
      margin-top: 80px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .qr-code {
      position: absolute;
      ${getQRPosition(template.qr_settings.position)}
    }
    .qr-code img {
      width: ${template.qr_settings.size}px;
      height: ${template.qr_settings.size}px;
    }
  </style>
</head>
<body>
  <div class="certificate-container">
`;

  // Header Section
  if (sections.header.enabled && template.header_mode === "with_header") {
    html += `
    <div class="header">
      ${sections.header.logo_url ? `<img src="${sections.header.logo_url}" alt="Logo">` : ''}
      <h1>${replacePlaceholders(sections.header.title, context)}</h1>
    </div>
`;
  }

  // Meta Section (Ref No & Date)
  html += `
    <div class="meta">
      <div><strong>Ref No:</strong> ${replacePlaceholders(sections.meta.ref_no, context)}</div>
      <div><strong>Date:</strong> ${replacePlaceholders(sections.meta.date, context)}</div>
    </div>
`;

  // Receiver Section
  html += `
    <div class="receiver">
      <div><strong>To,</strong></div>
      <div>${replacePlaceholders(sections.receiver.to, context)}</div>
      <div>${replacePlaceholders(sections.receiver.company, context)}</div>
      <div>${replacePlaceholders(sections.receiver.address, context)}</div>
    </div>
`;

  // Subject Section
  html += `
    <div class="subject">
      <strong>Subject:</strong> ${replacePlaceholders(sections.subject.text, context)}
    </div>
`;

  // Body Section
  html += `
    <div class="body">
      <p>Dear Sir/Madam,</p>
`;

  // Render paragraphs
  for (const paragraph of sections.body.paragraphs) {
    html += `      <p>${replacePlaceholders(paragraph, context)}</p>\n`;
  }

  // Render conditional paragraphs
  if (sections.body.conditions) {
    for (const condition of sections.body.conditions) {
      if (evaluateCondition(condition.if, context)) {
        html += `      <p>${replacePlaceholders(condition.then, context)}</p>\n`;
      }
    }
  }

  html += `
      <p>Thanking you.</p>
    </div>
`;

  // Signature Section
  html += `
    <div class="signature">
      <div style="margin-bottom: 40px;">Yours faithfully,</div>
      <div><strong>${replacePlaceholders(sections.signature.name, context)}</strong></div>
      <div>${replacePlaceholders(sections.signature.designation, context)}</div>
`;

  if (sections.signature.email) {
    html += `      <div>Email: ${replacePlaceholders(sections.signature.email, context)}</div>\n`;
  }

  if (sections.signature.mobile) {
    html += `      <div>Mobile: ${replacePlaceholders(sections.signature.mobile, context)}</div>\n`;
  }

  html += `
    </div>
`;

  // Footer Section
  if (sections.footer.enabled) {
    html += `
    <div class="footer">
      ${replacePlaceholders(sections.footer.text, context)}
    </div>
`;
  }

  // QR Code (if enabled)
  if (template.qr_settings.enabled && context.qr_code_data_url) {
    html += `
    <div class="qr-code">
      <img src="${context.qr_code_data_url}" alt="QR Code">
    </div>
`;
  }

  html += `
  </div>
</body>
</html>
`;

  return html;
}

/**
 * Replace {{placeholder | filter}} with actual values from context
 * Supports filters like upper, lower, capitalize, date
 */
export function replacePlaceholders(
  text: string,
  context: TemplateContext
): string {
  if (!text) return "";
  
  return text.replace(/\{\{([^{|}]+)(?:\|([^{|}]+))?\}\}/g, (match, key, filter) => {
    key = key.trim();
    let value = context[key];
    
    if (value === undefined || value === null) {
      return match;
    }
    
    if (filter) {
      const filters = filter.split('|').map((f: string) => f.trim());
      for (const f of filters) {
        const [filterName, ...args] = f.split(':').map((a: string) => a.trim().replace(/['"]/g, ''));
        
        switch (filterName.toLowerCase()) {
          case 'upper':
            value = String(value).toUpperCase();
            break;
          case 'lower':
            value = String(value).toLowerCase();
            break;
          case 'capitalize':
            value = String(value).charAt(0).toUpperCase() + String(value).slice(1);
            break;
          case 'date':
            try {
               const dateObj = new Date(value);
               if (args[0] === 'short') {
                  value = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
               } else if (args[0] === 'full') {
                  value = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
               } else {
                  value = dateObj.toLocaleDateString('en-IN');
               }
            } catch (e) { value = String(value); }
            break;
          case 'bold':
            value = `<strong>${value}</strong>`;
            break;
        }
      }
    }
    
    return String(value);
  });
}

/**
 * Evaluate conditional expressions
 * Supports: ==, !=, >, <, >=, <=
 */
export function evaluateCondition(
  condition: string,
  context: TemplateContext
): boolean {
  // Replace placeholders first
  const evaluated = replacePlaceholders(condition, context);
  
  // Parse and evaluate the condition
  const operators = ['==', '!=', '>=', '<=', '>', '<'];
  
  for (const op of operators) {
    if (evaluated.includes(op)) {
      const [left, right] = evaluated.split(op).map(s => s.trim().replace(/['"]/g, ''));
      
      switch (op) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '>':
          return parseFloat(left) > parseFloat(right);
        case '<':
          return parseFloat(left) < parseFloat(right);
        case '>=':
          return parseFloat(left) >= parseFloat(right);
        case '<=':
          return parseFloat(left) <= parseFloat(right);
      }
    }
  }
  
  return false;
}

/**
 * Get CSS position for QR code based on position setting
 */
function getQRPosition(position: string): string {
  switch (position) {
    case 'top-left':
      return 'top: 20px; left: 20px;';
    case 'top-right':
      return 'top: 20px; right: 20px;';
    case 'bottom-left':
      return 'bottom: 20px; left: 20px;';
    case 'bottom-right':
      return 'bottom: 20px; right: 20px;';
    default:
      return 'bottom: 20px; right: 20px;';
  }
}

/**
 * Validate that all required placeholders are present in context
 */
export function validateContext(
  template: TemplateJson,
  context: TemplateContext
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  // Use form_fields as the source of truth for required placeholders
  for (const field of template.form_fields || []) {
    if (field.required && (context[field.name] === undefined || context[field.name] === null)) {
      missing.push(field.name);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Extract placeholders from a text string
 */
export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  
  return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
}

/**
 * Generate form fields from template
 */
export function generateFormFields(template: TemplateJson) {
  return template.form_fields.map(field => ({
    name: field.name,
    type: field.type,
    label: field.label,
    required: field.required,
    validation: field.validation,
    source: field.source,
    filter_by: field.filter_by,
    conditional: field.conditional
  }));
}

/**
 * Validate form data against template form fields
 */
export function validateFormData(
  template: TemplateJson,
  formData: Record<string, any>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  for (const field of template.form_fields) {
    const value = formData[field.name];
    
    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.name] = `${field.label} is required`;
      continue;
    }
    
    // Skip validation if field is empty and not required
    if (!value) continue;
    
    // Validate based on field type
    switch (field.type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors[field.name] = `${field.label} must be a valid email`;
        }
        break;
      
      case 'phone':
        if (!/^\d{10,15}$/.test(value.replace(/[\s\-\(\)]/g, ''))) {
          errors[field.name] = `${field.label} must be a valid phone number`;
        }
        break;
      
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          errors[field.name] = `${field.label} must be in YYYY-MM-DD format`;
        }
        break;
      
      case 'number':
        if (isNaN(Number(value))) {
          errors[field.name] = `${field.label} must be a number`;
        }
        break;
    }
    
    // Custom validation rules
    if (field.validation) {
      const rules = field.validation.split(',');
      for (const rule of rules) {
        const [ruleName, ruleValue] = rule.split(':');
        
        switch (ruleName.trim()) {
          case 'min':
            if (String(value).length < parseInt(ruleValue)) {
              errors[field.name] = `${field.label} must be at least ${ruleValue} characters`;
            }
            break;
          
          case 'max':
            if (String(value).length > parseInt(ruleValue)) {
              errors[field.name] = `${field.label} must be at most ${ruleValue} characters`;
            }
            break;
          
          case 'pattern':
            const regex = new RegExp(ruleValue);
            if (!regex.test(String(value))) {
              errors[field.name] = `${field.label} format is invalid`;
            }
            break;
        }
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Build context from application data and master data
 */
export function buildContext(
  application: any,
  branch: any,
  company: any,
  additionalData: Record<string, any> = {}
): TemplateContext {
  const formData = typeof application.form_data === 'string' 
    ? JSON.parse(application.form_data) 
    : application.form_data;
  
  return {
    // Application data
    student_name: application.student_name,
    reg_no: application.reg_no,
    
    // Branch data
    branch_name: branch.name,
    branch_code: branch.code,
    hod_name: branch.hod_name,
    hod_designation: branch.hod_designation,
    hod_email: branch.hod_email,
    hod_mobile: branch.hod_mobile,
    
    // Company data
    company_name: company.name,
    company_hr_title: company.hr_title,
    company_address: company.address,
    
    // Form data (dynamic fields)
    ...formData,
    
    // Additional data (ref_no, serial, year, etc.)
    ...additionalData
  };
}
