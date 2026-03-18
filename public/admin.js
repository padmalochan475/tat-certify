const state = {
  adminUsers: [],
  auditLog: [],
  students: [],
  branches: [],
  companies: [],
  sessions: [],
  durations: [],
  templates: [],
  certificateLog: [],
  googleConfig: null
}

const elements = {
  flash: document.querySelector("#admin-flash"),
  loginCard: document.querySelector("#login-card"),
  loginForm: document.querySelector("#login-form"),
  googleLoginPanel: document.querySelector("#google-login-panel"),
  googleLoginButton: document.querySelector("#google-login-button"),
  googleLoginNote: document.querySelector("#google-login-note"),
  dashboard: document.querySelector("#dashboard"),
  refreshButton: document.querySelector("#refresh-admin"),
  logoutButton: document.querySelector("#logout-button"),
  requestsBody: document.querySelector("#requests-body"),
  requestSummary: document.querySelector("#request-summary"),
  generatorForm: document.querySelector("#generator-form"),
  generatorStudent: document.querySelector("#generator-student"),
  generatorTemplate: document.querySelector("#generator-template"),
  generatorIssuedOn: document.querySelector("#generator-issued-on"),
  generatorHint: document.querySelector("#generator-hint"),
  previewFrame: document.querySelector("#preview-frame"),
  previewRef: document.querySelector("#preview-ref"),
  printButton: document.querySelector("#print-button"),
  googleRequestSummary: document.querySelector("#google-request-summary"),
  googleUsersBody: document.querySelector("#google-users-body"),
  branchForm: document.querySelector("#branch-form"),
  sessionForm: document.querySelector("#session-form"),
  durationForm: document.querySelector("#duration-form"),
  companyForm: document.querySelector("#company-form"),
  templateForm: document.querySelector("#template-form"),
  templateType: document.querySelector("#template-type"),
  templateContent: document.querySelector("#template-content"),
  prefillTemplate: document.querySelector("#prefill-template"),
  branchList: document.querySelector("#branch-list"),
  sessionList: document.querySelector("#session-list"),
  durationList: document.querySelector("#duration-list"),
  companyList: document.querySelector("#company-list"),
  logBody: document.querySelector("#log-body"),
  auditLogBody: document.querySelector("#audit-log-body")
}

let flashTimer = null
let googleScriptPromise = null

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

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google)
  }

  if (googleScriptPromise) {
    return googleScriptPromise
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error("Unable to load Google Sign-In"))
    document.head.append(script)
  })

  return googleScriptPromise
}

function approvedStudents() {
  return state.students.filter((student) => student.status === "Approved")
}

function activeTemplatesForType(type) {
  return state.templates.filter((template) => template.active && template.type === type)
}

function baseTemplateContent(type) {
  return (
    state.templates.find((template) => template.active && template.type === type)?.content || ""
  )
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  )
}

function toggleAuthenticated(isAuthenticated) {
  elements.loginCard.classList.toggle("hidden", isAuthenticated)
  elements.dashboard.classList.toggle("hidden", !isAuthenticated)
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    throw new Error("Google login did not return a credential")
  }

  const result = await request("/api/admin/google-login", {
    method: "POST",
    body: JSON.stringify({
      credential: response.credential,
      client_id: state.googleConfig?.clientId
    })
  })

  toggleAuthenticated(true)
  showFlash(`Signed in as ${result.username}`, "success")
  await loadBootstrap()
}

async function loadGoogleLogin() {
  const config = await request("/api/admin/google/config")
  state.googleConfig = config

  if (!config.enabled) {
    elements.googleLoginPanel.classList.add("hidden")
    return
  }

  elements.googleLoginNote.textContent = `Sign in with your ${config.hostedDomain} Google Workspace account. First use creates an approval request for an existing admin.`
  elements.googleLoginPanel.classList.remove("hidden")

  const google = await loadGoogleIdentityScript()
  google.accounts.id.initialize({
    client_id: config.clientId,
    callback: (response) =>
      handleGoogleCredential(response).catch((error) => showFlash(error.message, "error"))
  })
  elements.googleLoginButton.innerHTML = ""
  google.accounts.id.renderButton(elements.googleLoginButton, {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    width: 320
  })
}

function renderRequests() {
  const pending = state.students.filter((student) => student.status === "Pending").length
  const approved = state.students.filter((student) => student.status === "Approved").length
  elements.requestSummary.textContent = `${pending} pending, ${approved} approved`

  if (state.students.length === 0) {
    elements.requestsBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">No student requests yet.</td></tr>'
    return
  }

  elements.requestsBody.innerHTML = state.students
    .map((student) => {
      const badgeClass = student.status === "Approved" ? "approved" : "pending"
      const actions =
        student.status === "Pending"
          ? `
            <div class="table-actions">
              <button class="button ghost" type="button" data-action="approve" data-id="${student.id}">Approve</button>
              <button class="button secondary" type="button" data-action="reject" data-id="${student.id}">Remove</button>
            </div>
          `
          : `
            <div class="table-actions">
              <button class="button ghost" type="button" data-action="prepare-generate" data-id="${student.id}">Generate</button>
            </div>
          `

      return `
        <tr>
          <td>
            <strong>${escapeHtml(student.full_name)}</strong><br />
            <span class="muted">${escapeHtml(student.reg_no)} | ${escapeHtml(student.branch)}</span><br />
            <span class="muted">${escapeHtml(student.year)} | ${escapeHtml(student.session)}</span>
          </td>
          <td>
            <strong>${escapeHtml(student.company)}</strong><br />
            <span class="muted">${escapeHtml(student.company_hr_title)}</span><br />
            <span class="muted">${escapeHtml(student.company_address).replaceAll("\n", "<br />")}</span>
          </td>
          <td>
            ${escapeHtml(student.cert_type)}<br />
            <span class="muted">${escapeHtml(student.duration)} from ${escapeHtml(student.start_date)}</span>
          </td>
          <td><span class="badge ${badgeClass}">${escapeHtml(student.status)}</span></td>
          <td>${actions}</td>
        </tr>
      `
    })
    .join("")
}

function renderGoogleUsers() {
  const pending = state.adminUsers.filter((user) => user.status === "Pending").length
  const approved = state.adminUsers.filter((user) => user.status === "Approved").length
  elements.googleRequestSummary.textContent = `${pending} pending, ${approved} approved`

  if (state.adminUsers.length === 0) {
    elements.googleUsersBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">No Google sign-in requests yet.</td></tr>'
    return
  }

  elements.googleUsersBody.innerHTML = state.adminUsers
    .map((user) => {
      const badgeClass = user.status === "Approved" ? "approved" : "pending"
      const actions =
        user.status === "Pending"
          ? `
            <div class="table-actions">
              <button class="button ghost" type="button" data-google-action="approve" data-id="${user.id}">Approve</button>
              <button class="button secondary" type="button" data-google-action="remove" data-id="${user.id}">Remove</button>
            </div>
          `
          : `
            <div class="table-actions">
              <button class="button secondary" type="button" data-google-action="remove" data-id="${user.id}">Remove</button>
            </div>
          `

      return `
        <tr>
          <td>
            <strong>${escapeHtml(user.email)}</strong><br />
            <span class="muted">${escapeHtml(user.auth_provider)}</span>
          </td>
          <td><span class="badge ${badgeClass}">${escapeHtml(user.status)}</span></td>
          <td>${escapeHtml(formatDateTime(user.created_at))}</td>
          <td>${user.approved_at ? escapeHtml(formatDateTime(user.approved_at)) : '<span class="muted">Not approved</span>'}</td>
          <td>${actions}</td>
        </tr>
      `
    })
    .join("")
}

function populateGenerator(preferredStudentId = "", preferredTemplateId = "") {
  const approved = approvedStudents()
  elements.generatorStudent.innerHTML =
    '<option value="">Select approved student</option>' +
    approved
      .map(
        (student) =>
          `<option value="${escapeHtml(student.id)}"${
            student.id === preferredStudentId ? " selected" : ""
          }>${escapeHtml(student.full_name)} (${escapeHtml(student.reg_no)})</option>`
      )
      .join("")

  const student = approved.find((entry) => entry.id === elements.generatorStudent.value)

  if (!student) {
    elements.generatorTemplate.innerHTML = '<option value="">Select template</option>'
    elements.generatorHint.textContent = "Approve a request to enable certificate generation"
    return
  }

  const templates = activeTemplatesForType(student.cert_type)
  elements.generatorTemplate.innerHTML =
    '<option value="">Select template</option>' +
    templates
      .map(
        (template) =>
          `<option value="${escapeHtml(template.id)}"${
            template.id === preferredTemplateId ? " selected" : ""
          }>${escapeHtml(template.name)}</option>`
      )
      .join("")

  elements.generatorHint.textContent = `${student.cert_type} templates for ${student.full_name}`
}

function renderList(container, items) {
  if (items.length === 0) {
    container.innerHTML = '<div class="list-item"><p>No records yet.</p></div>'
    return
  }

  container.innerHTML = items.join("")
}

function renderMasterLists() {
  renderList(
    elements.branchList,
    state.branches.map(
      (branch) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(branch.code)} - ${escapeHtml(branch.name)}</strong>
            <p>${escapeHtml(branch.hod_name)} | ${escapeHtml(branch.hod_email)} | ${escapeHtml(branch.hod_mobile)}</p>
            <p>Serial starts from ${escapeHtml(branch.current_serial)} for ${escapeHtml(branch.serial_year)}</p>
          </div>
          <button class="button secondary" type="button" data-list-action="delete-branch" data-value="${escapeHtml(branch.code)}">Delete</button>
        </div>
      `
    )
  )

  renderList(
    elements.sessionList,
    state.sessions.map(
      (session) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(session.value)}</strong>
            <p>${session.active ? "Visible in student form" : "Hidden from student form"}</p>
          </div>
          <button class="button secondary" type="button" data-list-action="delete-session" data-value="${escapeHtml(session.value)}">Delete</button>
        </div>
      `
    )
  )

  renderList(
    elements.durationList,
    state.durations.map(
      (duration) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(duration.cert_type)} - ${escapeHtml(duration.label)}</strong>
            <p>${duration.active ? "Visible in student form" : "Hidden from student form"}</p>
          </div>
          <button class="button secondary" type="button" data-list-action="delete-duration" data-value="${escapeHtml(duration.id)}">Delete</button>
        </div>
      `
    )
  )

  renderList(
    elements.companyList,
    state.companies.map(
      (company) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(company.name)}</strong>
            <p>${escapeHtml(company.hr_title)}</p>
            <p>${escapeHtml(company.address).replaceAll("\n", "<br />")}</p>
          </div>
          <button class="button secondary" type="button" data-list-action="delete-company" data-value="${escapeHtml(company.name)}">Delete</button>
        </div>
      `
    )
  )
}

function renderLogs() {
  if (state.certificateLog.length === 0) {
    elements.logBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">No certificates generated yet.</td></tr>'
    return
  }

  elements.logBody.innerHTML = state.certificateLog
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.ref_no)}<br /><span class="muted">${escapeHtml(
            entry.academic_year
          )}</span></td>
          <td><strong>${escapeHtml(entry.student_name)}</strong><br /><span class="muted">${escapeHtml(
            entry.reg_no
          )}</span></td>
          <td>${escapeHtml(entry.cert_type)}</td>
          <td>${escapeHtml(entry.template_name)}</td>
          <td>${escapeHtml(
            formatDateTime(entry.generated_on)
          )}</td>
        </tr>
      `
    )
    .join("")
}

function renderAuditLog() {
  if (state.auditLog.length === 0) {
    elements.auditLogBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">No admin activity recorded yet.</td></tr>'
    return
  }

  elements.auditLogBody.innerHTML = state.auditLog
    .map((entry) => {
      let detailsText = ""
      if (entry.details) {
        try {
          const parsed = JSON.parse(entry.details)
          detailsText = Object.entries(parsed)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" | ")
        } catch {
          detailsText = entry.details
        }
      }

      return `
        <tr>
          <td><strong>${escapeHtml(entry.actor_email)}</strong><br /><span class="muted">${escapeHtml(entry.actor_method)}</span></td>
          <td>${escapeHtml(entry.action)}</td>
          <td>${escapeHtml(entry.target_type)}<br /><span class="muted">${escapeHtml(entry.target_id)}</span></td>
          <td>${detailsText ? escapeHtml(detailsText) : '<span class="muted">No details</span>'}</td>
          <td>${escapeHtml(formatDateTime(entry.created_at))}</td>
        </tr>
      `
    })
    .join("")
}

function syncTemplateDraft(force = false) {
  if (!force && elements.templateContent.value.trim()) {
    return
  }

  const content = baseTemplateContent(elements.templateType.value)
  if (content) {
    elements.templateContent.value = content
  }
}

async function loadBootstrap() {
  const selectedStudentId = elements.generatorStudent.value
  const selectedTemplateId = elements.generatorTemplate.value
  const data = await request("/api/admin/bootstrap")

  state.adminUsers = data.adminUsers
  state.auditLog = data.auditLog
  state.students = data.students
  state.branches = data.branches
  state.companies = data.companies
  state.sessions = data.sessions
  state.durations = data.durations
  state.templates = data.templates
  state.certificateLog = data.certificateLog

  renderRequests()
  renderGoogleUsers()
  populateGenerator(selectedStudentId, selectedTemplateId)
  renderMasterLists()
  renderLogs()
  renderAuditLog()
  syncTemplateDraft(false)
}

async function checkSession() {
  const session = await request("/api/admin/session")
  toggleAuthenticated(session.authenticated)
  if (session.authenticated) {
    await loadBootstrap()
  }
}

async function handleLogin(event) {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(elements.loginForm).entries())
  await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.loginForm.reset()
  toggleAuthenticated(true)
  showFlash("Admin login successful.", "success")
  await loadBootstrap()
}

async function handleLogout() {
  await request("/api/admin/logout", { method: "POST" })
  window.google?.accounts?.id?.disableAutoSelect?.()
  toggleAuthenticated(false)
  elements.previewFrame.srcdoc = ""
  elements.previewRef.textContent = "No preview generated yet."
  elements.printButton.disabled = true
  showFlash("Logged out.", "info")
}

async function handleRequestAction(event) {
  const target = event.target.closest("button[data-action]")
  if (!target) {
    return
  }

  const action = target.dataset.action
  const studentId = target.dataset.id

  if (action === "approve") {
    await request(`/api/admin/students/${studentId}/approve`, { method: "PATCH" })
    showFlash("Request approved and company directory updated.", "success")
    await loadBootstrap()
    return
  }

  if (action === "reject") {
    await request(`/api/admin/students/${studentId}`, { method: "DELETE" })
    showFlash("Request removed.", "info")
    await loadBootstrap()
    return
  }

  if (action === "prepare-generate") {
    elements.generatorStudent.value = studentId
    populateGenerator(studentId)
    elements.generatorForm.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

async function handleGoogleUserAction(event) {
  const target = event.target.closest("button[data-google-action]")
  if (!target) {
    return
  }

  const action = target.dataset.googleAction
  const userId = target.dataset.id

  if (action === "approve") {
    await request(`/api/admin/google-users/${userId}/approve`, { method: "PATCH" })
    showFlash("Google sign-in request approved.", "success")
    await loadBootstrap()
    return
  }

  if (action === "remove") {
    await request(`/api/admin/google-users/${userId}`, { method: "DELETE" })
    showFlash("Google sign-in request removed.", "info")
    await loadBootstrap()
  }
}

async function handleListAction(event) {
  const target = event.target.closest("button[data-list-action]")
  if (!target) {
    return
  }

  const action = target.dataset.listAction
  const value = encodeURIComponent(target.dataset.value)

  if (action === "delete-branch") {
    await request(`/api/admin/branches/${value}`, { method: "DELETE" })
    showFlash("Branch deleted.", "info")
  } else if (action === "delete-session") {
    await request(`/api/admin/sessions/${value}`, { method: "DELETE" })
    showFlash("Academic session deleted.", "info")
  } else if (action === "delete-duration") {
    await request(`/api/admin/durations/${value}`, { method: "DELETE" })
    showFlash("Duration option deleted.", "info")
  } else if (action === "delete-company") {
    await request(`/api/admin/companies/${value}`, { method: "DELETE" })
    showFlash("Company deleted.", "info")
  }

  await loadBootstrap()
}

async function handleBranchSubmit(event) {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(elements.branchForm).entries())
  if (payload.current_serial === "") {
    delete payload.current_serial
  } else {
    payload.current_serial = Number(payload.current_serial)
  }
  if (payload.serial_year === "") {
    delete payload.serial_year
  } else {
    payload.serial_year = Number(payload.serial_year)
  }
  await request("/api/admin/branches", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.branchForm.reset()
  showFlash("Branch saved.", "success")
  await loadBootstrap()
}

async function handleSessionSubmit(event) {
  event.preventDefault()
  const formData = new FormData(elements.sessionForm)
  const payload = Object.fromEntries(formData.entries())
  payload.active = formData.get("active") === "on"
  await request("/api/admin/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.sessionForm.reset()
  showFlash("Academic session saved.", "success")
  await loadBootstrap()
}

async function handleDurationSubmit(event) {
  event.preventDefault()
  const formData = new FormData(elements.durationForm)
  const payload = Object.fromEntries(formData.entries())
  payload.active = formData.get("active") === "on"
  await request("/api/admin/durations", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.durationForm.reset()
  showFlash("Duration option saved.", "success")
  await loadBootstrap()
}

async function handleCompanySubmit(event) {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(elements.companyForm).entries())
  await request("/api/admin/companies", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.companyForm.reset()
  showFlash("Company saved.", "success")
  await loadBootstrap()
}

async function handleTemplateSubmit(event) {
  event.preventDefault()
  const formData = new FormData(elements.templateForm)
  const payload = Object.fromEntries(formData.entries())
  payload.active = formData.get("active") === "on"

  if (!String(payload.content || "").trim()) {
    payload.content = baseTemplateContent(payload.type)
  }

  await request("/api/admin/templates", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.templateForm.reset()
  elements.templateType.value = "Internship"
  syncTemplateDraft(true)
  showFlash("Template saved.", "success")
  await loadBootstrap()
}

async function handleGenerate(event) {
  event.preventDefault()
  const payload = {
    studentId: elements.generatorStudent.value,
    templateId: elements.generatorTemplate.value,
    issuedOn: elements.generatorIssuedOn.value || undefined
  }
  const result = await request("/api/admin/certificates/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  elements.previewFrame.srcdoc = result.html
  elements.previewRef.textContent = `${result.refNo} | Academic Year ${result.academicYear}`
  elements.printButton.disabled = false
  showFlash(`Certificate generated: ${result.refNo}`, "success")
  await loadBootstrap()
}

function printPreview() {
  const frameWindow = elements.previewFrame.contentWindow
  if (!frameWindow) {
    showFlash("Generate a preview first.", "error")
    return
  }
  frameWindow.focus()
  frameWindow.print()
}

elements.loginForm.addEventListener("submit", (event) =>
  handleLogin(event).catch((error) => showFlash(error.message, "error"))
)
elements.logoutButton.addEventListener("click", () =>
  handleLogout().catch((error) => showFlash(error.message, "error"))
)
elements.refreshButton.addEventListener("click", () =>
  loadBootstrap()
    .then(() => showFlash("Dashboard refreshed.", "info"))
    .catch((error) => showFlash(error.message, "error"))
)
elements.requestsBody.addEventListener("click", (event) =>
  handleRequestAction(event).catch((error) => showFlash(error.message, "error"))
)
elements.googleUsersBody.addEventListener("click", (event) =>
  handleGoogleUserAction(event).catch((error) => showFlash(error.message, "error"))
)
elements.branchList.addEventListener("click", (event) =>
  handleListAction(event).catch((error) => showFlash(error.message, "error"))
)
elements.sessionList.addEventListener("click", (event) =>
  handleListAction(event).catch((error) => showFlash(error.message, "error"))
)
elements.durationList.addEventListener("click", (event) =>
  handleListAction(event).catch((error) => showFlash(error.message, "error"))
)
elements.companyList.addEventListener("click", (event) =>
  handleListAction(event).catch((error) => showFlash(error.message, "error"))
)
elements.branchForm.addEventListener("submit", (event) =>
  handleBranchSubmit(event).catch((error) => showFlash(error.message, "error"))
)
elements.sessionForm.addEventListener("submit", (event) =>
  handleSessionSubmit(event).catch((error) => showFlash(error.message, "error"))
)
elements.durationForm.addEventListener("submit", (event) =>
  handleDurationSubmit(event).catch((error) => showFlash(error.message, "error"))
)
elements.companyForm.addEventListener("submit", (event) =>
  handleCompanySubmit(event).catch((error) => showFlash(error.message, "error"))
)
elements.templateForm.addEventListener("submit", (event) =>
  handleTemplateSubmit(event).catch((error) => showFlash(error.message, "error"))
)
elements.generatorForm.addEventListener("submit", (event) =>
  handleGenerate(event).catch((error) => showFlash(error.message, "error"))
)
elements.generatorStudent.addEventListener("change", () =>
  populateGenerator(elements.generatorStudent.value)
)
elements.prefillTemplate.addEventListener("click", () => syncTemplateDraft(true))
elements.templateType.addEventListener("change", () => syncTemplateDraft(false))
elements.printButton.addEventListener("click", printPreview)

elements.generatorIssuedOn.value = new Date().toISOString().slice(0, 10)

Promise.all([loadGoogleLogin(), checkSession()]).catch((error) => showFlash(error.message, "error"))
