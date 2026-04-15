import { supabase } from './supabase.js'
import { getCurrentUser, hasPermission } from './auth.js'
import { roleDashboards } from './roles.js'
import { setupUploadModal } from './document-upload.js'
import { createIcons, icons } from 'lucide'

let currentUser = null
let currentPage = 1
let currentData = []
let latestPhotoUrlByAlumniId = new Map()
const itemsPerPage = 10

function setDashboardLink() {
  const link = document.getElementById('dashboardLink')
  if (!link || !currentUser) return
  link.href = roleDashboards[currentUser.role] || '/index.html'
}

function setupActionButtons() {
  const actionBar = document.getElementById('actionBar')
  if (!actionBar) return

  const buttons = []

  if (hasPermission('canEdit')) {
    buttons.push(`
      <button class="btn-report" id="addAlumniBtn" type="button">
        <i data-lucide="user-plus" aria-hidden="true"></i>
        Add Alumni
      </button>
    `)
  }

  if (hasPermission('canUpload')) {
    buttons.push(`
      <button class="btn-report" id="bulkUploadBtn" type="button">
        <i data-lucide="paperclip" aria-hidden="true"></i>
        Bulk Upload
      </button>
    `)
  }

  if (hasPermission('canGenerateReports')) {
    buttons.push(`
      <button class="btn-report" id="exportReportBtn" type="button">
        <i data-lucide="download" aria-hidden="true"></i>
        Export CSV
      </button>
    `)
    buttons.push(`
      <button class="btn-report" id="printViewBtn" type="button">
        <i data-lucide="printer" aria-hidden="true"></i>
        Print View
      </button>
    `)
  }

  actionBar.innerHTML = buttons.join('')
  createIcons({ icons })

  document.getElementById('addAlumniBtn')?.addEventListener('click', () => openCreateModal())
  document.getElementById('exportReportBtn')?.addEventListener('click', exportReport)
  document.getElementById('printViewBtn')?.addEventListener('click', printCurrentView)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    alert('Popup blocked. Please allow popups to print.')
    return null
  }

  w.document.open()
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root { color-scheme: light; }
          body { font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          .meta { font-size: 12px; color: #475569; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f8fafc; text-align: left; }
          .section { margin: 18px 0 8px; font-weight: 700; font-size: 13px; }
          a { color: #1d4ed8; text-decoration: none; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `)
  w.document.close()
  return w
}

function printCurrentView() {
  if (!hasPermission('canGenerateReports')) {
    alert('You do not have permission to print')
    return
  }

  const start = (currentPage - 1) * itemsPerPage
  const end = start + itemsPerPage
  const pageData = currentData.slice(start, end)

  const rowsHtml = pageData
    .map((a) => {
      const locationLabel = a.is_local ? 'Local' : a.current_country ? a.current_country : 'International'
      return `
        <tr>
          <td>${escapeHtml(a.student_id || '—')}</td>
          <td>${escapeHtml(a.full_name || '—')}</td>
          <td>${escapeHtml(a.graduation_year || '—')}</td>
          <td>${escapeHtml(a.course || '—')}</td>
          <td>${escapeHtml(a.employment_status || 'N/A')}</td>
          <td>${escapeHtml(a.current_company || 'N/A')}</td>
          <td>${escapeHtml(a.current_position || 'N/A')}</td>
          <td>${escapeHtml(locationLabel)}</td>
        </tr>
      `
    })
    .join('')

  const now = new Date().toLocaleString()
  const title = `Alumni Information (Page ${currentPage})`
  const w = openPrintWindow(
    title,
    `
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">Generated: ${escapeHtml(now)}</p>
      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Name</th>
            <th>Year</th>
            <th>Course</th>
            <th>Employment</th>
            <th>Company</th>
            <th>Position</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="8">No data</td></tr>'}</tbody>
      </table>
    `,
  )

  w?.focus()
  w?.print()
}

async function loadAlumni() {
  let query = supabase.from('alumni').select('*')

  if (currentUser.role === 'department_head' && currentUser.department) {
    query = query.eq('course', currentUser.department)
  }

  const year = document.getElementById('yearFilter')?.value
  const course = document.getElementById('courseFilter')?.value
  const employment = document.getElementById('employmentFilter')?.value
  const search = document.getElementById('searchInput')?.value?.trim()

  if (year) query = query.eq('graduation_year', parseInt(year))
  if (course) query = query.eq('course', course)
  if (employment) query = query.eq('employment_status', employment)
  if (search) {
    // supports enhanced schema fields when present
    query = query.or(`full_name.ilike.%${search}%,student_id.ilike.%${search}%`)
  }

  const { data, error } = await query.order('graduation_year', { ascending: false })

  if (error) {
    console.error(error)
    renderError('Failed to load alumni.')
    return
  }

  currentData = data || []

  // Best-effort: load latest photo per alumni (stored as alumni_documents.document_type = 'Photo')
  latestPhotoUrlByAlumniId = new Map()
  const { data: photos, error: photoErr } = await supabase
    .from('alumni_documents')
    .select('alumni_id, file_url, created_at')
    .eq('document_type', 'Photo')
    .order('created_at', { ascending: false })
  if (photoErr) {
    console.error(photoErr)
  } else {
    for (const p of photos || []) {
      if (!latestPhotoUrlByAlumniId.has(p.alumni_id) && p.file_url) {
        latestPhotoUrlByAlumniId.set(p.alumni_id, p.file_url)
      }
    }
  }

  renderTable()
  renderPagination()
  populateFilters()
}

function renderError(message) {
  const tbody = document.getElementById('alumniTableBody')
  if (tbody) tbody.innerHTML = `<tr><td colspan="10">${message}</td></tr>`
}

function renderTable() {
  const start = (currentPage - 1) * itemsPerPage
  const end = start + itemsPerPage
  const pageData = currentData.slice(start, end)

  const tbody = document.getElementById('alumniTableBody')
  if (!tbody) return

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10">No alumni found</td></tr>'
    return
  }

  tbody.innerHTML = pageData
    .map((alumnus) => {
      const employmentClass = alumnus.employment_status
        ? alumnus.employment_status.toLowerCase().replace(/\s+/g, '-')
        : 'na'

      const canEdit = hasPermission('canEdit')
      const canUpload = hasPermission('canUpload')
      const canPrint = hasPermission('canGenerateReports')

      const locationLabel = alumnus.is_local
        ? 'Local'
        : alumnus.current_country
          ? alumnus.current_country
          : 'International'

      return `
        <tr data-id="${alumnus.id}">
          <td>${alumnus.student_id || '—'}</td>
          <td><strong>${alumnus.full_name || '—'}</strong></td>
          <td>${alumnus.graduation_year || '—'}</td>
          <td>${alumnus.course || '—'}</td>
          <td>
            <span class="status-badge status-${employmentClass}">
              ${alumnus.employment_status || 'N/A'}
            </span>
          </td>
          <td>${alumnus.current_company || 'N/A'}</td>
          <td>${alumnus.current_position || 'N/A'}</td>
          <td>
            <span class="location-pill">
              <i data-lucide="${alumnus.is_local ? 'map-pin' : 'globe'}" aria-hidden="true"></i>
              ${locationLabel}
            </span>
          </td>
          <td>
            ${
              latestPhotoUrlByAlumniId.get(alumnus.id)
                ? `<img class="alumni-photo" src="${latestPhotoUrlByAlumniId.get(alumnus.id)}" alt="Photo of ${escapeHtml(alumnus.full_name || 'alumnus')}" loading="lazy" />`
                : '<span class="muted">—</span>'
            }
          </td>
          <td class="action-buttons">
            ${
              canEdit
                ? `<button class="btn-icon" type="button" title="Edit" onclick="editAlumni('${alumnus.id}')"><i data-lucide="pencil"></i></button>`
                : ''
            }
            ${
              canUpload
                ? `<button class="btn-icon" type="button" title="Upload document" onclick="openUploadModal('${alumnus.id}')"><i data-lucide="upload"></i></button>`
                : ''
            }
            ${
              canUpload
                ? `<button class="btn-icon" type="button" title="Upload photo" onclick="openUploadModal('${alumnus.id}', { presetType: 'Photo', accept: 'image/*', hideAcademic: true })"><i data-lucide="camera"></i></button>`
                : ''
            }
            ${
              canPrint
                ? `<button class="btn-icon" type="button" title="Print info & documents" onclick="printAlumni('${alumnus.id}')"><i data-lucide="printer"></i></button>`
                : ''
            }
            <button class="btn-icon" type="button" title="View history" onclick="viewHistory('${alumnus.id}')"><i data-lucide="history"></i></button>
          </td>
        </tr>
      `
    })
    .join('')

  createIcons({ icons })
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(currentData.length / itemsPerPage))
  const pagination = document.getElementById('pagination')
  if (!pagination) return

  let buttons = ''
  for (let i = 1; i <= totalPages; i++) {
    buttons += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`
  }
  pagination.innerHTML = buttons
}

window.goToPage = (page) => {
  currentPage = page
  renderTable()
  renderPagination()
}

function populateSelect(selectEl, values) {
  values.forEach((value) => {
    if (![...selectEl.options].some((opt) => opt.value === String(value))) {
      selectEl.add(new Option(value, value))
    }
  })
}

function populateFilters() {
  const yearSelect = document.getElementById('yearFilter')
  const courseSelect = document.getElementById('courseFilter')

  if (yearSelect) {
    const years = [...new Set(currentData.map((a) => a.graduation_year).filter(Boolean))].sort(
      (a, b) => b - a,
    )
    populateSelect(yearSelect, years)
  }

  if (courseSelect) {
    const courses = [...new Set(currentData.map((a) => a.course).filter(Boolean))].sort()
    populateSelect(courseSelect, courses)
  }
}

function setupFilters() {
  const ids = ['yearFilter', 'courseFilter', 'employmentFilter']
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      currentPage = 1
      loadAlumni()
    })
  })

  document.getElementById('searchInput')?.addEventListener('input', () => {
    currentPage = 1
    loadAlumni()
  })

  document.getElementById('resetFilters')?.addEventListener('click', () => {
    document.querySelectorAll('.filters-bar select, .filters-bar input').forEach((el) => {
      el.value = ''
    })
    currentPage = 1
    loadAlumni()
  })
}

function setupEditModal() {
  const modal = document.getElementById('editModal')
  const closeBtn = document.querySelector('.modal-close')
  const cancelBtn = document.getElementById('cancelEdit')
  const form = document.getElementById('editAlumniForm')
  const titleEl = document.getElementById('editModalTitle')
  const studentIdEl = document.getElementById('editStudentId')

  if (!modal || !form) return

  const close = () => {
    modal.style.display = 'none'
    modal.setAttribute('aria-hidden', 'true')
    form.reset()
  }

  closeBtn?.addEventListener('click', close)
  cancelBtn?.addEventListener('click', close)

  window.addEventListener('click', (event) => {
    if (event.target === modal) close()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!hasPermission('canEdit')) {
      alert('You do not have permission to edit')
      return
    }

    const id = document.getElementById('editAlumniId').value
    const studentId = document.getElementById('editStudentId')?.value?.trim()

    if (!studentId) {
      alert('Student ID is required')
      return
    }

    const updates = {
      student_id: studentId,
      full_name: document.getElementById('editFullName').value,
      graduation_year: parseInt(document.getElementById('editGradYear').value),
      course: document.getElementById('editCourse').value,
      employment_status: document.getElementById('editEmploymentStatus').value || null,
      current_company: document.getElementById('editCompany').value || null,
      current_position: document.getElementById('editPosition').value || null,
      is_local: document.getElementById('editIsLocal').value === 'true',
      email: document.getElementById('editEmail').value || null,
      contact_number: document.getElementById('editContact').value || null,
      updated_by: currentUser.id,
      updated_at: new Date(),
    }

    const isCreate = !id
    const { error } = isCreate
      ? await supabase.from('alumni').insert({ ...updates, created_by: currentUser.id, created_at: new Date() })
      : await supabase.from('alumni').update(updates).eq('id', id)
    if (error) {
      console.error(error)
      alert(`Error saving: ${error.message}`)
      return
    }

    close()
    await loadAlumni()
  })

  window.editAlumni = (id) => {
    if (!hasPermission('canEdit')) {
      alert('You do not have permission to edit')
      return
    }
    const alumnus = currentData.find((a) => a.id === id)
    if (!alumnus) return

    document.getElementById('editAlumniId').value = alumnus.id
    if (titleEl) titleEl.textContent = 'Edit Alumni Information'
    if (studentIdEl) studentIdEl.readOnly = true
    document.getElementById('editStudentId').value = alumnus.student_id || ''
    document.getElementById('editFullName').value = alumnus.full_name || ''
    document.getElementById('editGradYear').value = alumnus.graduation_year || ''
    document.getElementById('editCourse').value = alumnus.course || ''
    document.getElementById('editEmploymentStatus').value = alumnus.employment_status || 'Employed'
    document.getElementById('editCompany').value = alumnus.current_company || ''
    document.getElementById('editPosition').value = alumnus.current_position || ''
    document.getElementById('editIsLocal').value = alumnus.is_local ? 'true' : 'false'
    document.getElementById('editEmail').value = alumnus.email || ''
    document.getElementById('editContact').value = alumnus.contact_number || ''

    modal.style.display = 'block'
    modal.setAttribute('aria-hidden', 'false')
    createIcons({ icons })
  }

  async function getNextStudentId(courseValue) {
    const year = String(new Date().getFullYear())
    const suffix = String(courseValue || 'PC')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'PC'

    const { data, error } = await supabase
      .from('alumni')
      .select('student_id')
      .like('student_id', `${year}-%`)
      .order('student_id', { ascending: false })
      .limit(200)

    if (error) {
      console.error(error)
      return `${year}-0001-${suffix}`
    }

    let maxSeq = 0
    for (const row of data || []) {
      const m = String(row.student_id || '').match(/^(\d{4})-(\d{4})-/)
      if (m && m[1] === year) maxSeq = Math.max(maxSeq, parseInt(m[2], 10) || 0)
    }
    const next = String(maxSeq + 1).padStart(4, '0')
    return `${year}-${next}-${suffix}`
  }

  async function openCreateModal() {
    if (!hasPermission('canEdit')) return

    document.getElementById('editAlumniId').value = ''
    if (titleEl) titleEl.textContent = 'Add Alumni'
    if (studentIdEl) studentIdEl.readOnly = false

    // clear fields
    document.getElementById('editStudentId').value = ''
    document.getElementById('editFullName').value = ''
    document.getElementById('editGradYear').value = new Date().getFullYear()
    document.getElementById('editCourse').value = ''
    document.getElementById('editEmploymentStatus').value = 'Employed'
    document.getElementById('editCompany').value = ''
    document.getElementById('editPosition').value = ''
    document.getElementById('editIsLocal').value = 'true'
    document.getElementById('editEmail').value = ''
    document.getElementById('editContact').value = ''

    // generate Student ID (default suffix PC; updates if course filled before save)
    const generated = await getNextStudentId('PC')
    document.getElementById('editStudentId').value = generated

    // if user types course, regenerate once (best-effort)
    const courseEl = document.getElementById('editCourse')
    const handler = async () => {
      const val = courseEl?.value?.trim()
      if (!val) return
      const nextId = await getNextStudentId(val)
      document.getElementById('editStudentId').value = nextId
      courseEl?.removeEventListener('blur', handler)
    }
    courseEl?.addEventListener('blur', handler)

    modal.style.display = 'block'
    modal.setAttribute('aria-hidden', 'false')
    createIcons({ icons })
  }

  window.openCreateModal = openCreateModal
}

window.viewHistory = async (id) => {
  const { data, error } = await supabase
    .from('alumni_history')
    .select('field_changed, old_value, new_value, changed_at')
    .eq('alumni_id', id)
    .order('changed_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error(error)
    alert('Error loading history')
    return
  }

  if (!data || data.length === 0) {
    alert('No history found for this alumni')
    return
  }

  const lines = data.map((r) => {
    const when = new Date(r.changed_at).toLocaleString()
    return `• ${when}\n  ${r.field_changed}: ${r.old_value ?? 'NULL'} → ${r.new_value ?? 'NULL'}`
  })
  alert(`Change History (latest 20)\n\n${lines.join('\n\n')}`)
}

window.printAlumni = async (id) => {
  if (!hasPermission('canGenerateReports')) {
    alert('You do not have permission to print')
    return
  }

  const alumnus = currentData.find((a) => a.id === id)
  if (!alumnus) return

  const { data: docs, error: docsError } = await supabase
    .from('alumni_documents')
    .select('document_type, file_name, file_url, academic_year, semester, created_at')
    .eq('alumni_id', id)
    .order('created_at', { ascending: false })

  if (docsError) console.error(docsError)

  const locationLabel = alumnus.is_local
    ? 'Local'
    : alumnus.current_country
      ? alumnus.current_country
      : 'International'

  const docsRows = (docs || [])
    .map((d) => {
      const when = d.created_at ? new Date(d.created_at).toLocaleString() : ''
      const ay = d.academic_year || ''
      const sem = d.semester || ''
      const details = [ay, sem].filter(Boolean).join(' • ')
      return `
        <tr>
          <td>${escapeHtml(d.document_type || '—')}</td>
          <td>${escapeHtml(d.file_name || '—')}</td>
          <td>${details ? escapeHtml(details) : '—'}</td>
          <td>${when ? escapeHtml(when) : '—'}</td>
          <td>${d.file_url ? `<a href="${escapeHtml(d.file_url)}" target="_blank" rel="noreferrer">Open</a>` : '—'}</td>
        </tr>
      `
    })
    .join('')

  const now = new Date().toLocaleString()
  const title = `Alumni Record: ${alumnus.full_name || alumnus.student_id || id}`
  const w = openPrintWindow(
    title,
    `
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">Generated: ${escapeHtml(now)}</p>

      <div class="section">Alumni Information</div>
      <table>
        <tbody>
          <tr><th style="width: 220px;">Student ID</th><td>${escapeHtml(alumnus.student_id || '—')}</td></tr>
          <tr><th>Full Name</th><td>${escapeHtml(alumnus.full_name || '—')}</td></tr>
          <tr><th>Graduation Year</th><td>${escapeHtml(alumnus.graduation_year || '—')}</td></tr>
          <tr><th>Course</th><td>${escapeHtml(alumnus.course || '—')}</td></tr>
          <tr><th>Employment Status</th><td>${escapeHtml(alumnus.employment_status || 'N/A')}</td></tr>
          <tr><th>Company</th><td>${escapeHtml(alumnus.current_company || 'N/A')}</td></tr>
          <tr><th>Position</th><td>${escapeHtml(alumnus.current_position || 'N/A')}</td></tr>
          <tr><th>Location</th><td>${escapeHtml(locationLabel)}</td></tr>
          <tr><th>Email</th><td>${escapeHtml(alumnus.email || '—')}</td></tr>
          <tr><th>Contact</th><td>${escapeHtml(alumnus.contact_number || '—')}</td></tr>
        </tbody>
      </table>

      <div class="section">Documents</div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>File</th>
            <th>Academic Year / Semester</th>
            <th>Uploaded</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>${docsRows || '<tr><td colspan="5">No documents found</td></tr>'}</tbody>
      </table>
    `,
  )

  w?.focus()
  w?.print()
}

async function exportReport() {
  let query = supabase.from('alumni').select('*')
  if (currentUser.role === 'department_head' && currentUser.department) {
    query = query.eq('course', currentUser.department)
  }
  const { data, error } = await query
  if (error) {
    alert('Failed to export')
    return
  }

  const header = [
    'Student ID',
    'Full Name',
    'Grad Year',
    'Course',
    'Employment',
    'Company',
    'Position',
    'Location',
    'Email',
    'Contact',
  ]
  const rows = (data || []).map((a) => [
    a.student_id ?? '',
    a.full_name ?? '',
    a.graduation_year ?? '',
    a.course ?? '',
    a.employment_status ?? '',
    a.current_company ?? '',
    a.current_position ?? '',
    a.is_local ? 'Local' : a.current_country ?? 'International',
    a.email ?? '',
    a.contact_number ?? '',
  ])

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `alumni_report_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function init() {
  currentUser = getCurrentUser()
  if (!currentUser) {
    window.location.href = '/index.html'
    return
  }

  setDashboardLink()
  setupActionButtons()
  setupFilters()
  setupEditModal()
  setupUploadModal()
  await loadAlumni()
  createIcons({ icons })
}

init()

