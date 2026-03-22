const state = {
  adminUsers: [],
  auditLog: [],
  branches: [],
  companies: [],
  sessions: [],
  durations: [],
  templates: [],
  certificateLog: [],
  googleConfig: null,
  applications: [],
  branchContacts: [],
  templatesV2: [],
}

let elements = {}
let flashTimer = null
let googleScriptPromise = null
let extractedPlaceholders = []

function initializeElements() {
  const selectors = {
    flash: "#admin-flash",
    loginCard: "#login-card",
    loginForm: "#login-form",
    googleLoginPanel: "#google-login-panel",
    googleLoginButton: "#google-login-button",
    googleLoginNote: "#google-login-note",
    dashboard: "#dashboard",
    refreshButton: "#refresh-admin",
    logoutButton: "#logout-button",
    requestsBody: "#requests-body",
    requestSummary: "#request-summary",
    generatorForm: "#generator-form",
    generatorStudent: "#generator-student",
    generatorTemplate: "#generator-template",
    generatorIssuedOn: "#generator-issued-on",
    generatorHint: "#generator-hint",
    previewFrame: "#preview-frame",
    previewRef: "#preview-ref",
    printButton: "#print-button",
    googleUsersBody: "#google-users-body",
    googleRequestSummary: "#google-request-summary",
    branchForm: "#branch-form",
    sessionForm: "#session-form",
    durationForm: "#duration-form",
    companyForm: "#company-form",
    branchList: "#branch-list",
    sessionList: "#session-list",
    durationList: "#duration-list",
    companyList: "#company-list",
    auditLogBody: "#audit-log-body",
    filterStatus: "#filter-status",
    filterBranchApplications: "#filter-branch-applications",
    filterSearch: "#filter-search",
    bulkAction: "#bulk-action",
    selectAll: ".select-all",
    smartTemplateForm: "#smart-template-form",
    smartTemplateName: "#smart-template-name",
    smartTemplateType: "#smart-template-type",
    smartTemplateHtml: "#smart-template-html",
    btnExtractFields: "#btn-extract-fields",
    smartFieldsContainer: "#smart-fields-container",
    extractedFieldsList: "#extracted-fields-list",
    btnSaveSmartTemplate: "#btn-save-smart-template",
    designerFrame: "#template-v2-preview-frame",
    branchContactForm: "#branch-contact-form",
    branchContactList: "#branch-contact-list"
  };

  for (const [key, selector] of Object.entries(selectors)) {
    elements[key] = document.querySelector(selector);
  }
}

function escapeHtml(v) { return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }

function showFlash(message, tone = "info") {
  console.log(`Flash [${tone}]: ${message}`);
  if (!elements.flash) { alert(message); return; }
  clearTimeout(flashTimer);
  elements.flash.hidden = false;
  elements.flash.className = `flash ${tone}`;
  elements.flash.textContent = message;
  flashTimer = setTimeout(() => { elements.flash.hidden = true }, 5000);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(body?.message || `Terminal Protocol Error: ${response.status}`);
  return body;
}

function formatDateTime(v) { return v ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "N/A"; }

function toggleAuthenticated(isAuthenticated) {
  if (elements.loginCard) elements.loginCard.classList.toggle("hidden", isAuthenticated);
  if (elements.dashboard) elements.dashboard.classList.toggle("hidden", !isAuthenticated);
  document.querySelector("#admin-header-actions")?.classList.toggle("hidden", !isAuthenticated);
  if (isAuthenticated) {
      loadBootstrap().catch(e => showFlash(e.message, "error"));
      loadGoogleLogin().catch(() => {});
  }
}

async function checkSession() {
  try {
    const session = await request("/api/admin/session")
    toggleAuthenticated(session.authenticated)
  } catch (err) { toggleAuthenticated(false); }
}

async function handleLogin(e) {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.loginForm).entries());
  try {
    await request("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    showFlash("Authentication Sequence Complete.", "success");
    toggleAuthenticated(true);
  } catch (err) { showFlash(err.message, "error"); }
}

async function loadBootstrap() {
  const data = await request("/api/admin/bootstrap");
  Object.assign(state, data);
  renderInbox();
  renderMasterLists();
  renderAuditLog();
  renderGoogleUsers();
  renderBranchContacts();
  populateGenerator();
  
  if (elements.filterBranchApplications) {
      elements.filterBranchApplications.innerHTML = '<option value="all">Department: All</option>' + 
          state.branches.map(b => `<option value="${b.code}">${b.name}</option>`).join("");
  }
}

function renderInbox() {
  if (!elements.requestsBody) return;
  const sFilter = elements.filterStatus?.value || '';
  const bFilter = elements.filterBranchApplications?.value || 'all';
  const search = elements.filterSearch?.value?.toLowerCase() || '';

  const filtered = state.applications.filter(app => {
    const matchS = !sFilter || app.status.toLowerCase() === sFilter.toLowerCase();
    const matchB = bFilter === 'all' || app.branch_id === bFilter;
    const matchSearch = !search || app.student_name.toLowerCase().includes(search) || app.reg_no.toLowerCase().includes(search);
    return matchS && matchB && matchSearch;
  });

  const pending = state.applications.filter(a => ['submitted', 'pending'].includes(a.status.toLowerCase())).length;
  const completed = state.applications.filter(a => a.status.toLowerCase() === 'completed').length;
  
  if (elements.requestSummary) elements.requestSummary.textContent = `${pending} applications currently awaiting institutional review.`;
  if (document.querySelector("#stat-pending")) document.querySelector("#stat-pending").textContent = pending;
  if (document.querySelector("#stat-completed")) document.querySelector("#stat-completed").textContent = completed;
  if (document.querySelector("#stat-branches")) document.querySelector("#stat-branches").textContent = state.branches.length;

  elements.requestsBody.innerHTML = filtered.length ? filtered.map(app => `
    <tr>
      <td><input type="checkbox" class="bulk-check" value="${app.id}"></td>
      <td><strong>${escapeHtml(app.student_name)}</strong><br><small class="muted">${escapeHtml(app.reg_no)}</small></td>
      <td>${escapeHtml(app.branch_id)}</td>
      <td>${escapeHtml(app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A')}</td>
      <td><span class="badge badge-${app.status.toLowerCase()}">${app.status}</span></td>
      <td>
        <div class="table-actions">
          ${['submitted', 'pending'].includes(app.status.toLowerCase()) ? `
            <button class="button small ghost" data-action="approve" data-id="${app.id}">Approve</button>
            <button class="button small secondary" data-action="reject" data-id="${app.id}">Reject</button>
          ` : ''}
          ${app.status.toLowerCase() === 'approved' ? `<button class="button small ghost" data-action="prepare" data-id="${app.id}">Execute</button>` : ''}
        </div>
      </td>
    </tr>
  `).join("") : '<tr><td colspan="6" class="empty-row">Filter criteria returned zero records.</td></tr>';
}

function renderMasterLists() {
  if (elements.branchList) elements.branchList.innerHTML = state.branches.map(b => `<div class="list-item"><div><strong>${b.code}</strong> - ${b.name}</div><button class="button small secondary" data-action="delete-branch" data-id="${b.code}"><i class="fas fa-trash"></i></button></div>`).join("");
  if (elements.sessionList) elements.sessionList.innerHTML = state.sessions.map(s => `<div class="list-item"><div><strong>${s.value}</strong> ${s.active ? '(Active)' : '(Hidden)'}</div><button class="button small secondary" data-action="delete-session" data-id="${s.value}"><i class="fas fa-trash"></i></button></div>`).join("");
  if (elements.companyList) elements.companyList.innerHTML = state.companies.map(c => `<div class="list-item"><div><strong>${c.name}</strong><br><small>${c.hr_title}</small></div><button class="button small secondary" data-action="delete-company" data-id="${c.name}"><i class="fas fa-trash"></i></button></div>`).join("");
}

function renderAuditLog() {
  if (!elements.auditLogBody) return;
  elements.auditLogBody.innerHTML = state.auditLog.map(l => `<tr><td>${escapeHtml(l.actor_email)}</td><td>${l.action}</td><td>${l.target_type}</td><td><code>${escapeHtml(l.details)}</code></td><td>${formatDateTime(l.created_at)}</td></tr>`).join("");
}

function renderGoogleUsers() {
  if (!elements.googleUsersBody) return;
  const pending = state.adminUsers.filter(u => u.status === 'Pending').length;
  if (elements.googleRequestSummary) elements.googleRequestSummary.textContent = `${pending} access requests pending institutional review.`;
  elements.googleUsersBody.innerHTML = state.adminUsers.map(u => `<tr><td><strong>${u.email}</strong></td><td><span class="badge ${u.status.toLowerCase()}">${u.status}</span></td><td>${formatDateTime(u.created_at)}</td><td>${formatDateTime(u.approved_at)}</td><td>${u.status === 'Pending' ? `<button class="button small ghost" data-action="approve-google" data-id="${u.id}">Grant Access</button>` : ''}</td></tr>`).join("");
}

function renderBranchContacts() {
  if (!elements.branchContactList) return;
  elements.branchContactList.innerHTML = state.branchContacts.map(c => `<div class="card p-3 mb-2" style="border-left: 4px solid var(--accent);"><div class="flex-between"><div><strong>${c.contact_name}</strong> - ${c.designation}<br><small>${c.branch_id} | ${c.mobile_number}</small></div><button class="button small secondary" data-action="delete-contact" data-id="${c.id}">Remove</button></div></div>`).join("");
}

function populateGenerator(id = "") {
  if (!elements.generatorStudent) return;
  const approved = state.applications.filter(a => a.status.toLowerCase() === 'approved');
  elements.generatorStudent.innerHTML = '<option value="">Select Candidate Profile</option>' + approved.map(a => `<option value="${a.id}" ${a.id === id ? 'selected' : ''}>${a.student_name} (${a.reg_no})</option>`).join("");
  const temps = [...state.templates, ...state.templatesV2].filter(t => t.active);
  elements.generatorTemplate.innerHTML = '<option value="">Select Certificate Logic</option>' + temps.map(t => `<option value="${t.id}">${t.name} [${t.type}]</option>`).join("");
}

async function handleAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  try {
    if (action === "approve") { 
      await request(`/api/admin/applications/${id}`, { method: "PUT", body: JSON.stringify({ status: "approved" }) });
      showFlash("Application Authorized.", "success");
    } else if (action === "reject") {
      const reason = prompt("Enter Protocol Violation / Rejection Reason:");
      if (reason) await request(`/api/admin/applications/${id}`, { method: "PUT", body: JSON.stringify({ status: "rejected", rejection_reason: reason }) });
      showFlash("Application Flagged and Rejected.", "warning");
    } else if (action === "prepare") {
      populateGenerator(id);
      document.querySelector('[data-section="generator-section"]').click();
    } else if (action === "delete-branch") {
      if (confirm("Permanently wipe branch record?")) await request(`/api/admin/branches/${id}`, { method: "DELETE" });
    } else if (action === "delete-session") {
       if (confirm("Scrub academic session?")) await request(`/api/admin/sessions/${id}`, { method: "DELETE" });
    } else if (action === "delete-company") {
       if (confirm("Remove organization from directory?")) await request(`/api/admin/companies/${id}`, { method: "DELETE" });
    } else if (action === "delete-contact") {
       if (confirm("Wipe registry contact?")) await request(`/api/admin/branch-contacts/${id}`, { method: "DELETE" });
    } else if (action === "approve-google") {
       await request(`/api/admin/google-users/${id}/approve`, { method: "PATCH" });
       showFlash("Google Workspace Access Granted.", "success");
    }
    await loadBootstrap();
  } catch(err) { showFlash(err.message, "error"); }
}

async function handleGenerate(e) {
  e.preventDefault();
  const payload = { 
    application_id: elements.generatorStudent.value, 
    template_id: elements.generatorTemplate.value,
    issue_date: elements.generatorIssuedOn.value
  };
  try {
    const res = await request("/api/admin/certificates/generate", { method: "POST", body: JSON.stringify(payload) });
    showFlash(res.message, "success");
    elements.previewFrame.srcdoc = `<html><body style="background:#0f172a; color:#94a3b8; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;"><div><h2 style="color:white; margin-bottom:1rem;">Rendering Certificate</h2><p>Mapping database variables to secure format blueprint...</p></div></body></html>`;
    if (elements.previewRef) elements.previewRef.textContent = `ID: ${payload.application_id}`;
    
    const poll = setInterval(async () => {
      try {
        const status = await request(`/api/admin/certificates/${payload.application_id}/status`);
        if (status.status === 'completed') {
          clearInterval(poll);
          if (status.certificate?.html) elements.previewFrame.srcdoc = status.certificate.html;
          else elements.previewFrame.srcdoc = `<html><body style="padding:4rem; text-align:center; font-family:sans-serif;"><h1>Ready</h1><p>Manual PDF stream available in certificate log.</p></body></html>`;
          if (elements.printButton) elements.printButton.disabled = false;
        } else if (status.status === 'failed') {
          clearInterval(poll);
          showFlash("Generation Protocol Failed.", "error");
        }
      } catch (e) { clearInterval(poll); }
    }, 4000);
  } catch(err) { showFlash(err.message, "error"); }
}

function syncDesignerPreview() {
  const html = elements.smartTemplateHtml.value;
  if (!html || !elements.designerFrame) return;
  const preview = html.replace(/\{\{student_name\}\}/g, "John Doe").replace(/\{\{reg_no\}\}/g, "2401-PRST-V").replace(/\{\{branch_name\}\}/g, "Computer Science");
  elements.designerFrame.srcdoc = `<html><body style="font-family:sans-serif; padding:1rem;">${preview}</body></html>`;
}

function setupEventListeners() {
  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.logoutButton?.addEventListener("click", () => request("/api/admin/logout", { method: "POST" }).then(() => toggleAuthenticated(false)));
  elements.refreshButton?.addEventListener("click", () => loadBootstrap().then(() => showFlash("Terminal Synced.")));
  
  elements.requestsBody?.addEventListener("click", handleAction);
  elements.googleUsersBody?.addEventListener("click", handleAction);
  elements.branchList?.addEventListener("click", handleAction);
  elements.sessionList?.addEventListener("click", handleAction);
  elements.companyList?.addEventListener("click", handleAction);
  elements.branchContactList?.addEventListener("click", handleAction);
  
  elements.generatorForm?.addEventListener("submit", handleGenerate);
  elements.filterStatus?.addEventListener("change", renderInbox);
  elements.filterBranchApplications?.addEventListener("change", renderInbox);
  elements.filterSearch?.addEventListener("input", renderInbox);
  
  elements.selectAll?.addEventListener("change", (e) => {
    document.querySelectorAll(".bulk-check").forEach(cb => cb.checked = e.target.checked);
  });

  elements.bulkAction?.addEventListener("change", async (e) => {
    const action = e.target.value;
    if (!action) return;
    const ids = Array.from(document.querySelectorAll(".bulk-check:checked")).map(cb => cb.value);
    if (!ids.length) { showFlash("Queue selection empty.", "warning"); e.target.value = ""; return; }
    if (confirm(`Execute batch ${action} for ${ids.length} records?`)) {
        for (const id of ids) await request(`/api/admin/applications/${id}`, { method: "PUT", body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }) });
        showFlash(`Batch ${action} Sequence Finalized.`, "success");
        await loadBootstrap();
    }
    e.target.value = "";
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const sId = link.dataset.section;
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      document.querySelectorAll(".view-section").forEach(s => s.classList.add("hidden"));
      if (sId === "all") document.querySelectorAll(".view-section").forEach(s => s.classList.remove("hidden"));
      else document.querySelector(`#${sId}`)?.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Master Forms
  elements.branchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target).entries());
    await request("/api/admin/branches", { method: "POST", body: JSON.stringify(p) });
    showFlash("Branch Protocols Updated.", "success");
    e.target.reset(); await loadBootstrap();
  });
  elements.sessionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target).entries());
    p.active = e.target.querySelector('[name="active"]').checked;
    await request("/api/admin/sessions", { method: "POST", body: JSON.stringify(p) });
    showFlash("Session Directory Updated.", "success");
    e.target.reset(); await loadBootstrap();
  });
  elements.companyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target).entries());
    await request("/api/admin/companies", { method: "POST", body: JSON.stringify(p) });
    showFlash("Organization Profile Created.", "success");
    e.target.reset(); await loadBootstrap();
  });

  // Designer
  elements.btnExtractFields?.addEventListener("click", () => {
    const html = elements.smartTemplateHtml.value;
    const matches = [...html.matchAll(/\{\{([a-zA-Z0-9_| ]+)\}\}/g)].map(m => m[1].split('|')[0].trim());
    const standard = ['student_name', 'reg_no', 'branch_name', 'branch_code', 'company_name', 'company_hr_title', 'company_address', 'duration', 'start_date', 'year', 'session', 'academic_session', 'ref_no'];
    
    extractedPlaceholders = [...new Set(matches)].filter(p => !standard.includes(p));
    
    elements.smartFieldsContainer.classList.remove("hidden");
    elements.btnSaveSmartTemplate.classList.remove("hidden");

    if (extractedPlaceholders.length === 0) {
      elements.extractedFieldsList.innerHTML = `
        <div class="alert success" style="margin-top: 1rem;">
          <i class="fas fa-check-double"></i> Verified blueprint. No custom data inputs required.
        </div>`;
    } else {
      elements.extractedFieldsList.innerHTML = extractedPlaceholders.map(p => `
        <div class="card p-3 mb-3 border-glass field-builder" data-field="${p}" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div><span class="badge" style="background: var(--accent); color: white;">{{${p}}}</span></div>
          <label class="small-label">
             Public Label
             <input type="text" class="field-label" value="${p.replace(/_/g, ' ').toUpperCase()}" placeholder="Student face label" />
          </label>
          <label class="small-label">
             Protocol Type
             <select class="field-type">
               <option value="text">Short Input</option>
               <option value="textarea">Paragraph</option>
               <option value="date">Date</option>
               <option value="number">Numeric</option>
               <option value="dropdown">Dropdown List</option>
             </select>
          </label>
          <label class="small-label mt-2" style="grid-column: span 3;">
             Dropdown Source (comma-sep) or Field Hint
             <input type="text" class="field-hint" placeholder="Value A, Value B OR Tell student what to enter" />
          </label>
        </div>
      `).join('');
    }
    syncDesignerPreview();
  });

  elements.btnSaveSmartTemplate?.addEventListener("click", async () => {
    const fieldBlocks = document.querySelectorAll(".field-builder");
    const formFields = Array.from(fieldBlocks).map(block => {
        const name = block.dataset.field;
        const type = block.querySelector(".field-type").value;
        const hintVal = block.querySelector(".field-hint").value;
        return {
            name,
            label: block.querySelector(".field-label").value,
            type,
            required: true,
            hint: type === 'dropdown' ? '' : hintVal,
            options: type === 'dropdown' ? hintVal.split(',').map(s => s.trim()) : undefined
        };
    });

    const payload = {
      name: elements.smartTemplateName.value,
      type: elements.smartTemplateType.value,
      template_json: JSON.stringify({
        name: elements.smartTemplateName.value,
        format_html: elements.smartTemplateHtml.value,
        form_fields: formFields
      }),
      active: true
    };
    
    try {
      await request("/api/admin/templates-v2", { method: "POST", body: JSON.stringify(payload) });
      showFlash("Institutional Blueprint Saved.", "success");
      await loadBootstrap();
    } catch (e) { showFlash(e.message, "error"); }
  });
  elements.smartTemplateHtml?.addEventListener("input", syncDesignerPreview);
  
  elements.printButton?.addEventListener("click", () => {
     const w = elements.previewFrame.contentWindow;
     if (w) { w.focus(); w.print(); }
  });

  document.querySelector("#migrate-system")?.addEventListener("click", async () => {
     if (confirm("Migrate legacy student requests to the new applications system?")) {
         await request("/api/admin/system/migrate", { method: "POST" });
         showFlash("Migration Success.", "success");
         await loadBootstrap();
     }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeElements();
  setupEventListeners();
  checkSession().catch(() => {});
  if (elements.generatorIssuedOn) elements.generatorIssuedOn.value = new Date().toISOString().split('T')[0];
});
