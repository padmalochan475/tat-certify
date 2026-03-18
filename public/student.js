const state = {
  branches: [],
  companies: [],
  sessions: [],
  durations: []
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
  companyPreview: document.querySelector("#company-preview")
}

let flashTimer = null

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
}

async function handleSubmit(event) {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(elements.form).entries())

  await request("/api/student/requests", {
    method: "POST",
    body: JSON.stringify(payload)
  })

  elements.form.reset()
  elements.companyDirectory.value = ""
  setCompanyFieldsEditable(true)
  renderPreview(null)
  showFlash("Request submitted. Admin will review it.", "success")
  await loadBootstrap()
}

elements.companyDirectory.addEventListener("change", syncCompanyFields)
elements.certType.addEventListener("change", renderDurationOptions)
elements.form.addEventListener("submit", (event) =>
  handleSubmit(event).catch((error) => showFlash(error.message, "error"))
)

loadBootstrap().catch((error) => showFlash(error.message, "error"))
