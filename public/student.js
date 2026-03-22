const state = {
  branches: [],
  companies: [],
  sessions: [],
  durations: [],
  templates: [], // New dynamic templates
  selectedTemplate: null
}

const elements = {
  flash: document.querySelector("#student-flash"),
  form: document.querySelector("#student-form"),
  branchSelect: document.querySelector("#student-branch"),
  sessionSelect: document.querySelector("#student-session"),
  certType: document.querySelector("#student-cert-type"),
  durationSelect: document.querySelector("#student-duration"),
  companyDirectory: document.querySelector("#student-company-directory"),
  companyName: document.querySelector("#student-company-name"),
  companyHr: document.querySelector("#student-company-hr"),
  companyAddress: document.querySelector("#student-company-address"),
  companyPreview: document.querySelector("#company-preview"),
  statusTracker: document.querySelector("#status-tracker"),
  statusText: document.querySelector("#status-update-text"),
  statusBadge: document.querySelector("#status-badge"),
  statusProgress: document.querySelector("#status-progress-bar"),
  statusDetails: document.querySelector("#status-details"),
  certActions: document.querySelector("#certificate-actions"),
  
  // Unified dynamic fields
  templateContainer: document.querySelector("#template-container"),
  templateSelect: document.querySelector("#student-template"),
  dynamicFormSection: document.querySelector("#dynamic-form-section"),
  dynamicFieldsContainer: document.querySelector("#dynamic-fields-container"),
  
  // Dynamic Layout Toggling
  startDateInput: document.querySelector('input[name="start_date"]'),
  containerDuration: document.querySelector("#container-duration"),
  containerStartDate: document.querySelector("#container-start-date"),
  sectionHostOrg: document.querySelector("#section-host-org")
}

let flashTimer = null
let pollTimer = null

function saveLastRequest(id) {
  localStorage.setItem("tat_last_id", id)
}

function getLastRequestId() {
  return localStorage.getItem("tat_last_id")
}

async function renderStatus(application) {
  const currentStatus = application.status === 'submitted' ? 'Pending' : (application.status.charAt(0).toUpperCase() + application.status.slice(1));
  
  const statusLabels = {
    'Pending': 'Waiting for review',
    'Approved': 'Certificate generation in progress',
    'Rejected': 'Application rejected',
    'Processing': 'Generating secure document',
    'Completed': 'Ready for download',
    'Failed': 'Generation failed'
  }

  const badgeTones = {
    'Pending': 'info',
    'Approved': 'accent',
    'Rejected': 'error',
    'Processing': 'accent pulsing',
    'Completed': 'success',
    'Failed': 'error'
  }

  elements.statusTracker.classList.remove("hidden")
  elements.statusBadge.className = `badge ${badgeTones[currentStatus] || ''}`
  elements.statusBadge.textContent = currentStatus
  elements.statusText.textContent = statusLabels[currentStatus] || `Current status: ${currentStatus}`

  const progress = {
    'Pending': 20,
    'Approved': 50,
    'Processing': 75,
    'Completed': 100,
    'Failed': 75,
    'Rejected': 0
  }

  elements.statusProgress.style.width = `${progress[currentStatus] || 0}%`
  
  // Construct Timeline
  const stages = [
    { key: "Pending", threshold: 20, title: "Application Vaulted", desc: "Awaiting academic committee review." },
    { key: "Approved", threshold: 50, title: "Department Authorised", desc: "Request cleared. Rendering engine active." },
    { key: "Processing", threshold: 75, title: "Cryptographic Assembly", desc: "Mapping institutional variables to format." },
    { key: "Completed", threshold: 100, title: "Tokenized Credentials Ready", desc: "Secure document finalized seamlessly." }
  ];
  
  const currentProgress = progress[currentStatus] || 0;
  
  if (currentStatus === 'Rejected' || currentStatus === 'Failed') {
     elements.statusDetails.innerHTML = `<div style="padding: 1rem; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); border-radius: var(--radius-sm); margin-top: 1.5rem;">
        <strong style="color: var(--danger); font-size: 0.9rem;"><i class="fas fa-exclamation-triangle"></i> Verification Halted</strong>
        <p class="small muted mt-10" style="margin: 0; line-height: 1.4;">${currentStatus === 'Rejected' ? 'The department denied this request. Please contact your coordinator.' : 'The engine encountered a fatal generation error.'}</p>
     </div>`;
  } else {
     elements.statusDetails.innerHTML = `<div style="display: flex; flex-direction: column; gap: 1.25rem; margin-top: 2rem;">
        ${stages.map((stage, idx) => {
           const isDone = currentProgress >= stage.threshold;
           const isActive = currentProgress > (idx === 0 ? 0 : stages[idx-1].threshold) && currentProgress <= stage.threshold;
           const color = isDone ? 'var(--success)' : (isActive ? 'var(--accent)' : 'rgba(255,255,255,0.2)');
           const icon = isDone ? 'fa-check-circle' : (isActive ? 'fa-circle-notch fa-spin' : 'fa-circle');
           
           return `
             <div style="display: flex; gap: 1rem; opacity: ${isDone || isActive ? '1' : '0.4'};">
                <div style="color: ${color}; font-size: 1.25rem; margin-top: 2px;"><i class="fas ${icon}"></i></div>
                <div>
                   <strong style="color: white; font-size: 0.9rem;">${stage.title}</strong>
                   <div class="small muted" style="margin-top: 2px; line-height: 1.3;">${stage.desc}</div>
                </div>
             </div>
           `;
        }).join('')}
     </div>`;
  }
  
  elements.statusDetails.classList.remove("hidden");

  if (currentStatus === 'Completed') {
    elements.certActions.classList.remove("hidden")
  } else {
    elements.certActions.classList.add("hidden")
  }
}

async function checkStatus(id) {
  if (!id) return

  try {
    const data = await request(`/api/student/applications/${id}/status`)
    renderStatus(data)
    
    // Continue polling if not completed or failed or rejected
    if (!['Completed', 'Failed', 'Rejected'].includes(data.status)) {
      pollTimer = setTimeout(() => checkStatus(id), 5000)
    }
  } catch (error) {
    console.warn("Status check failed", error)
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function showFlash(message, tone = "info") {
  clearTimeout(flashTimer)
  elements.flash.hidden = false
  elements.flash.className = `flash ${tone}`
  elements.flash.textContent = message
  flashTimer = window.setTimeout(() => {
    elements.flash.hidden = true
  }, 4200)
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  })

  const contentType = response.headers.get("content-type") || ""
  const body = contentType.includes("application/json") ? await response.json() : null

  if (!response.ok) {
    const message =
      body?.message || (Array.isArray(body?.issues) ? body.issues.join(", ") : "Request failed")
    throw new Error(message)
  }

  return body
}

function populateSelect(select, options, placeholder) {
  select.innerHTML =
    `<option value="">${escapeHtml(placeholder)}</option>` +
    options
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
      )
      .join("")
}

function renderDurationOptions() {
  const certType = elements.certType.value
  const options = state.durations
    .filter((entry) => entry.active && entry.cert_type === certType)
    .map((entry) => ({
      value: entry.label,
      label: entry.label
    }))

  populateSelect(elements.durationSelect, options, "Select duration")
}

function setCompanyFieldsEditable(isEditable) {
  elements.companyName.readOnly = !isEditable
  elements.companyHr.readOnly = !isEditable
  elements.companyAddress.readOnly = !isEditable
}

function renderPreview(company) {
  if (!company) {
    elements.companyPreview.innerHTML =
      '<p class="muted">Select an approved company or choose "Other / New Company" to enter details manually.</p>'
    return
  }

  elements.companyPreview.innerHTML = `
    <p class="section-tag">Selected company</p>
    <strong>${escapeHtml(company.name)}</strong>
    <p>${escapeHtml(company.hr_title)}</p>
    <p>${escapeHtml(company.address).replaceAll("\n", "<br />")}</p>
  `
}

function syncCompanyFields() {
  const selectedValue = elements.companyDirectory.value

  if (!selectedValue || selectedValue === "__manual__") {
    if (selectedValue === "__manual__") {
      elements.companyName.value = ""
      elements.companyHr.value = ""
      elements.companyAddress.value = ""
    }

    setCompanyFieldsEditable(true)
    renderPreview(null)
    return
  }

  const company = state.companies.find((entry) => entry.name === selectedValue)
  if (!company) {
    setCompanyFieldsEditable(true)
    renderPreview(null)
    return
  }

  elements.companyName.value = company.name
  elements.companyHr.value = company.hr_title
  elements.companyAddress.value = company.address
  setCompanyFieldsEditable(false)
  renderPreview(company)
}

const DRAFT_KEY = "tat_student_form_draft";

elements.form.addEventListener("input", (e) => {
   if (e.target.type !== "file") {
      const formData = new FormData(elements.form);
      const draft = Object.fromEntries(formData.entries());
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
   }
});

function loadDraft() {
   const draftData = localStorage.getItem(DRAFT_KEY);
   if (draftData) {
      try {
         const draft = JSON.parse(draftData);
         Object.entries(draft).forEach(([key, value]) => {
            const input = elements.form.querySelector(`[name="${key}"]`);
            if (input && value && input.type !== 'hidden') {
               input.value = value;
            }
         });
      } catch(e) {}
   }
}

async function loadBootstrap() {
  const data = await request("/api/student/bootstrap")
  state.branches = data.branches
  state.companies = data.companies
  state.sessions = data.sessions
  state.durations = data.durations

  populateSelect(
    elements.branchSelect,
    state.branches.map((branch) => ({
      value: branch.code,
      label: `${branch.code} - ${branch.name}`
    })),
    "Select branch"
  )

  populateSelect(
    elements.sessionSelect,
    state.sessions.map((session) => ({
      value: session.value,
      label: session.value
    })),
    "Select academic session"
  )

  elements.companyDirectory.innerHTML =
    '<option value="">Select from approved companies</option>' +
    '<option value="__manual__">Other / New Company</option>' +
    state.companies
      .map(
        (company) =>
          `<option value="${escapeHtml(company.name)}">${escapeHtml(company.name)}</option>`
      )
      .join("")

  renderDurationOptions()
  syncCompanyFields()
  await updateTemplates()
  loadDraft()
}

async function updateTemplates() {
  const allTemplates = await request(`/api/templates-v2?active=true`);
  
  // Dynamically build 'Types of Opportunity' based on what exists! Pure No-Code!
  const uniqueTypes = [...new Set(allTemplates.map(t => t.type))];
  const currentType = elements.certType.value || uniqueTypes[0];
  
  if (elements.certType.options.length <= 2 && uniqueTypes.length > 0) {
    elements.certType.innerHTML = uniqueTypes.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    elements.certType.value = currentType;
  }
  
  state.templates = allTemplates.filter(t => t.type === elements.certType.value);

  if (state.templates.length > 0) {
    elements.templateContainer.classList.remove("hidden")
    elements.templateSelect.innerHTML =
      '<option value="">Select a format...</option>' +
      state.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
  } else {
    elements.templateContainer.classList.add("hidden")
    elements.dynamicFormSection.classList.add("hidden")
    state.selectedTemplate = null
  }
}

async function handleTemplateChange() {
  const templateId = elements.templateSelect.value
  if (!templateId) {
    elements.dynamicFormSection.classList.add("hidden")
    
    // Reset to legacy fallback requirements ensuring validation always passes
    if (elements.sectionHostOrg) {
       elements.sectionHostOrg.classList.remove('hidden');
       elements.companyDirectory.required = true;
       elements.companyName.required = true;
       elements.companyHr.required = true;
       elements.companyAddress.required = true;
    }
    
    if (elements.containerDuration) {
       elements.containerDuration.classList.remove('hidden');
       if(elements.durationSelect) elements.durationSelect.required = true;
    }
    
    if (elements.containerStartDate) {
       elements.containerStartDate.classList.remove('hidden');
       if(elements.startDateInput) elements.startDateInput.required = true;
    }

    state.selectedTemplate = null
    return
  }

  const template = state.templates.find(t => t.id === templateId)
  if (!template) return

  state.selectedTemplate = template
  const config = JSON.parse(template.template_json)
  const htmlDoc = config.format_html || "";
  
  // Intelligent Modular Forms: Hide static blocks if the template doesn't explicitly mention them!
  const hasCompany = htmlDoc.includes('{{company_name}}') || htmlDoc.includes('{{company_hr_title}}') || htmlDoc.includes('{{company_address}}');
  const hasDuration = htmlDoc.includes('{{duration}}');
  const hasStartDate = htmlDoc.includes('{{start_date}}');
  
  if (elements.sectionHostOrg) {
     elements.sectionHostOrg.classList.toggle('hidden', !hasCompany);
     elements.companyDirectory.required = hasCompany;
     elements.companyName.required = hasCompany;
     elements.companyHr.required = hasCompany;
     elements.companyAddress.required = hasCompany;
  }
  
  if (elements.containerDuration) {
     elements.containerDuration.classList.toggle('hidden', !hasDuration);
     if(elements.durationSelect) elements.durationSelect.required = hasDuration;
  }
  
  if (elements.containerStartDate) {
     elements.containerStartDate.classList.toggle('hidden', !hasStartDate);
     if(elements.startDateInput) elements.startDateInput.required = hasStartDate;
  }
  
  if (config.form_fields && config.form_fields.length > 0) {
    elements.dynamicFormSection.classList.remove("hidden")
    elements.dynamicFieldsContainer.innerHTML = (config.form_fields || []).map(field => {
      const required = field.required ? 'required' : ''
      const placeholder = field.placeholder || `Enter ${field.label}`
      const hint = field.hint ? `<small class="form-hint">${escapeHtml(field.hint)}</small>` : ''
      let inputHtml = ''
      
      const fieldId = `dyn-${field.name}`;
      
      if (field.type === 'dropdown') {
        const options = Array.isArray(field.options) ? field.options : (field.source || '').split(',').map(o => o.trim())
        inputHtml = `
          <select id="${fieldId}" name="field_${field.name}" ${required}>
            <option value="">Select ${escapeHtml(field.label)}</option>
            ${options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
          </select>
        `
      } else if (field.type === 'textarea') {
        inputHtml = `<textarea id="${fieldId}" name="field_${field.name}" ${required} placeholder="${escapeHtml(placeholder)}"></textarea>`
      } else {
        const type = ['email', 'number', 'date', 'phone'].includes(field.type) ? field.type : 'text';
        inputHtml = `<input id="${fieldId}" name="field_${field.name}" type="${type}" ${required} placeholder="${escapeHtml(placeholder)}" />`
      }

      return `
        <label for="${fieldId}" class="${field.full_width ? 'full-span' : ''}">
          <span class="label-text">${escapeHtml(field.label)} ${field.required ? '<span class="required-star">*</span>' : ''}</span>
          ${inputHtml}
          ${hint}
        </label>
      `
    }).join('')
  } else {
    elements.dynamicFormSection.classList.add("hidden")
  }
}

async function handleSubmit(event) {
  event.preventDefault()
  const formData = new FormData(elements.form)
  
  const templateId = elements.templateSelect.value || (state.templates[0]?.id);
  
  let payload;
  if (templateId) {
    payload = {
      template_id: templateId,
      student_name: formData.get("full_name"),
      reg_no: formData.get("reg_no"),
      branch_id: formData.get("branch"),
      form_data: {
        year: formData.get("year"),
        session: formData.get("session"),
        cert_type: formData.get("cert_type"),
        duration: formData.get("duration"),
        start_date: formData.get("start_date"),
        company_name: formData.get("company"),
        company_hr_title: formData.get("company_hr_title"),
        company_address: formData.get("company_address")
      }
    };
    
    // Add any dynamic fields
    elements.dynamicFieldsContainer.querySelectorAll("input, select, textarea").forEach(input => {
      payload.form_data[input.name.replace('field_', '')] = input.value;
    });
  } else {
    // Legacy mapping fallback
    payload = {
      full_name: formData.get("full_name"),
      reg_no: formData.get("reg_no"),
      branch: formData.get("branch"),
      year: formData.get("year"),
      session: formData.get("session"),
      cert_type: formData.get("cert_type"),
      company: formData.get("company"),
      company_hr_title: formData.get("company_hr_title"),
      company_address: formData.get("company_address"),
      duration: formData.get("duration"),
      start_date: formData.get("start_date")
    };
  }

  const result = await request("/api/student/applications", {
    method: "POST",
    body: JSON.stringify(payload)
  })

  saveLastRequest(result.id)
  localStorage.removeItem(DRAFT_KEY); // clear draft on success!
  
  showFlash("Request submitted successfully!", "success")
  renderStatus(result)
  elements.form.reset()
  elements.dynamicFormSection.classList.add("hidden")
  elements.companyDirectory.value = ""
  setCompanyFieldsEditable(true)
  checkStatus(result.id)
  await loadBootstrap()
}

document.querySelector("#download-certificate")?.addEventListener("click", async () => {
  const id = getLastRequestId()
  if (!id) return
  
  try {
    const data = await request(`/api/student/applications/${id}/status`)
    if (data.certificate?.pdf_url) {
      window.open(data.certificate.pdf_url, "_blank")
    } else {
      showFlash("Certificate file not found yet.", "error")
    }
  } catch (error) {
    showFlash(error.message, "error")
  }
})

elements.companyDirectory.addEventListener("change", syncCompanyFields)
elements.certType.addEventListener("change", () => {
  renderDurationOptions()
  updateTemplates()
})
elements.templateSelect.addEventListener("change", handleTemplateChange)
elements.form.addEventListener("submit", (event) =>
  handleSubmit(event).catch((error) => showFlash(error.message, "error"))
)

function updateSectionNumbers() {
  const sections = document.querySelectorAll('.form-section')
  let visibleCount = 0
  sections.forEach(sec => {
    if (!sec.classList.contains('hidden') && sec.offsetParent !== null) {
      visibleCount++
      const tag = sec.querySelector('.section-tag')
      if (tag) {
        tag.textContent = `Section ${String(visibleCount).padStart(2, '0')}`
      }
    }
  })
}

const lastId = getLastRequestId()
if (lastId) {
  checkStatus(lastId)
}

loadBootstrap().then(() => {
  updateSectionNumbers();
}).catch((error) => showFlash(error.message, "error"));

// Hook into template change to update numbers
const originalUpdateTemplates = updateTemplates;
updateTemplates = async (...args) => {
  await originalUpdateTemplates(...args);
  updateSectionNumbers();
};
