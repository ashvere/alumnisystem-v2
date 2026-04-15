import { supabase } from './supabase.js'
import { getCurrentUser, logout } from './auth.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function lookup() {
  const studentId = document.getElementById('studentIdLookup')?.value?.trim()
  const result = document.getElementById('studentResult')
  if (!result) return

  if (!studentId) {
    result.innerHTML = `<span class="muted">Please enter your Student ID.</span>`
    return
  }

  result.textContent = 'Loading...'

  const { data: alumni, error } = await supabase
    .from('alumni')
    .select('*')
    .eq('student_id', studentId)
    .limit(1)

  if (error) {
    console.error(error)
    result.innerHTML = `Failed to load.<br/><span class="muted">${escapeHtml(
      error.message || String(error),
    )}</span>`
    return
  }

  const row = (alumni || [])[0]
  if (!row) {
    result.innerHTML = `<span class="muted">No record found for that Student ID.</span>`
    return
  }

  const { data: docs, error: docsErr } = await supabase
    .from('alumni_documents')
    .select('document_type, file_name, file_url, created_at')
    .eq('alumni_id', row.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (docsErr) console.error(docsErr)

  const docsHtml =
    docs && docs.length
      ? `
        <div class="student-section">
          <div class="student-section-title">Documents</div>
          <div class="table-container">
            <table class="student-table">
              <thead>
                <tr><th>Type</th><th>File</th><th>Uploaded</th><th>Link</th></tr>
              </thead>
              <tbody>
                ${docs
                  .map((d) => {
                    const when = d.created_at ? new Date(d.created_at).toLocaleString() : '—'
                    const link = d.file_url
                      ? `<a href="${escapeHtml(d.file_url)}" target="_blank" rel="noreferrer">Open</a>`
                      : '—'
                    return `<tr>
                      <td>${escapeHtml(d.document_type || '—')}</td>
                      <td>${escapeHtml(d.file_name || '—')}</td>
                      <td>${escapeHtml(when)}</td>
                      <td>${link}</td>
                    </tr>`
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      : `<div class="student-section"><span class="muted">No documents found.</span></div>`

  const locationLabel = row.is_local
    ? 'Local'
    : row.current_country
      ? row.current_country
      : 'International'

  const items = [
    ['Course', row.course || '—'],
    ['Graduation Year', row.graduation_year || '—'],
    ['Employment', row.employment_status || '—'],
    ['Company', row.current_company || '—'],
    ['Position', row.current_position || '—'],
    ['Location', locationLabel],
    ['Email', row.email || '—'],
    ['Contact', row.contact_number || '—'],
  ]

  result.innerHTML = `
    <div class="student-card">
      <div class="student-header">
        <div>
          <div class="student-name">${escapeHtml(row.full_name || '—')}</div>
          <div class="student-sub">${escapeHtml(row.student_id || '—')}</div>
        </div>
      </div>

      <div class="student-section">
        <div class="student-section-title">Profile details</div>
        <div class="student-kv">
          ${items
            .map(
              ([k, v]) => `
              <div class="student-k">
                ${escapeHtml(k)}
              </div>
              <div class="student-v">
                ${escapeHtml(v)}
              </div>
            `,
            )
            .join('')}
        </div>
      </div>

      ${docsHtml}
    </div>
  `
}

async function loadByEmail() {
  const user = getCurrentUser()
  if (!user?.email) return false

  const result = document.getElementById('studentResult')
  if (!result) return false

  result.textContent = 'Loading...'

  const { data: alumni, error } = await supabase
    .from('alumni')
    .select('*')
    .eq('email', user.email)
    .limit(1)

  if (error) {
    console.error(error)
    result.innerHTML = `Failed to load.<br/><span class="muted">${escapeHtml(
      error.message || String(error),
    )}</span>`
    return true
  }

  const row = (alumni || [])[0]
  if (!row) {
    result.innerHTML = `<span class="muted">No alumni record found for ${escapeHtml(
      user.email,
    )}. You can still search using Student ID below.</span>`
    return false
  }

  // Populate UI by reusing existing renderer via a synthetic Student ID search
  document.getElementById('studentIdLookup').value = row.student_id || ''
  if (row.student_id) {
    await lookup()
    return true
  }

  return false
}

function setup() {
  const user = getCurrentUser()
  if (!user) {
    window.location.href = '/index.html'
    return
  }

  document.getElementById('logoutBtn')?.addEventListener('click', logout)
  document.getElementById('lookupBtn')?.addEventListener('click', lookup)
  document.getElementById('studentIdLookup')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookup()
  })

  document.getElementById('studentSubtitle').textContent = user.email ? ` • ${user.email}` : ''

  // If we know the email (from magic link), attempt to load record automatically.
  loadByEmail().catch(() => {})
}

setup()

