import { supabase } from './supabase.js'
import { getCurrentUser, hasPermission, logout } from './auth.js'
import { roleDashboards } from './roles.js'
import { createIcons, icons } from 'lucide'

function setDashboardLink() {
  const user = getCurrentUser()
  const link = document.getElementById('dashboardLink')
  if (!link) return
  link.href = user ? roleDashboards[user.role] || '/index.html' : '/index.html'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (!n) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

async function loadDocs() {
  const tbody = document.getElementById('docsTbody')
  if (!tbody) return

  const type = document.getElementById('docTypeFilter')?.value || ''
  const q = (document.getElementById('docSearch')?.value || '').trim().toLowerCase()

  const { data, error } = await supabase
    .from('alumni_documents')
    .select('document_type, file_name, file_url, file_size, academic_year, semester, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error(error)
    tbody.innerHTML = `<tr><td colspan="7">Failed to load documents.<br/><span class="muted">${escapeHtml(
      error.message || String(error),
    )}</span></td></tr>`
    return
  }

  let rows = data || []
  if (type) rows = rows.filter((r) => r.document_type === type)
  if (q) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))

  document.getElementById('docsSubtitle').textContent = ` • ${rows.length} record(s)`

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">No documents found.</td></tr>`
    return
  }

  tbody.innerHTML = rows
    .map((d) => {
      const when = d.created_at ? new Date(d.created_at).toLocaleString() : '—'
      const link = d.file_url
        ? `<a href="${escapeHtml(d.file_url)}" target="_blank" rel="noreferrer">Open</a>`
        : '—'
      return `
        <tr>
          <td>${escapeHtml(d.document_type || '—')}</td>
          <td>${escapeHtml(d.file_name || '—')}</td>
          <td>${escapeHtml(d.academic_year || '—')}</td>
          <td>${escapeHtml(d.semester || '—')}</td>
          <td>${escapeHtml(formatBytes(d.file_size))}</td>
          <td>${escapeHtml(when)}</td>
          <td>${link}</td>
        </tr>
      `
    })
    .join('')
}

async function seedSampleDocuments() {
  if (!hasPermission('canUpload')) {
    alert('You do not have permission to add documents')
    return
  }

  const btn = document.getElementById('seedDocsBtn')
  if (btn) btn.disabled = true

  // Pick an existing alumni record to attach sample docs to
  const { data: alumni, error: alumniErr } = await supabase.from('alumni').select('id').limit(1)
  if (alumniErr || !alumni || alumni.length === 0) {
    if (btn) btn.disabled = false
    alert('No alumni found to attach sample documents.')
    return
  }

  const alumniId = alumni[0].id
  const user = getCurrentUser()

  const now = new Date()
  const sample = [
    {
      alumni_id: alumniId,
      document_type: 'Transcript',
      file_name: 'Sample_Transcript.pdf',
      file_url: 'https://example.com/sample_transcript.pdf',
      file_size: 245760,
      mime_type: 'application/pdf',
      uploaded_by: user?.id || null,
      academic_year: `${now.getFullYear() - 1}-${now.getFullYear()}`,
      semester: '1st',
    },
    {
      alumni_id: alumniId,
      document_type: 'Diploma',
      file_name: 'Sample_Diploma.pdf',
      file_url: 'https://example.com/sample_diploma.pdf',
      file_size: 512000,
      mime_type: 'application/pdf',
      uploaded_by: user?.id || null,
      academic_year: `${now.getFullYear() - 1}-${now.getFullYear()}`,
      semester: '2nd',
    },
    {
      alumni_id: alumniId,
      document_type: 'Employment Certificate',
      file_name: 'Sample_Employment_Certificate.pdf',
      file_url: 'https://example.com/sample_employment_certificate.pdf',
      file_size: 188416,
      mime_type: 'application/pdf',
      uploaded_by: user?.id || null,
      academic_year: null,
      semester: null,
    },
  ]

  const { error } = await supabase.from('alumni_documents').insert(sample)
  if (error) {
    console.error(error)
    alert(`Failed to create sample documents: ${error.message}`)
  } else {
    alert('Sample documents created. (Links are placeholders.)')
    await loadDocs()
  }

  if (btn) btn.disabled = false
}

function printTable() {
  const table = document.getElementById('docsTable')
  if (!table) return

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    alert('Popup blocked. Please allow popups to print.')
    return
  }

  w.document.open()
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Documents</title>
        <style>
          body { font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          .meta { font-size: 12px; color: #475569; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; vertical-align: top; }
          th { background: #f8fafc; text-align: left; }
        </style>
      </head>
      <body>
        <h1>Documents</h1>
        <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        ${table.outerHTML}
      </body>
    </html>
  `)
  w.document.close()
  w.focus()
  w.print()
}

function setup() {
  const user = getCurrentUser()
  if (!user) {
    window.location.href = '/index.html'
    return
  }

  setDashboardLink()
  createIcons({ icons })

  document.getElementById('logoutBtn')?.addEventListener('click', logout)
  document.getElementById('refreshDocs')?.addEventListener('click', loadDocs)
  document.getElementById('docTypeFilter')?.addEventListener('change', loadDocs)
  document.getElementById('docSearch')?.addEventListener('input', loadDocs)
  document.getElementById('printDocsBtn')?.addEventListener('click', printTable)

  const seedBtn = document.getElementById('seedDocsBtn')
  if (seedBtn && hasPermission('canUpload')) {
    seedBtn.style.display = ''
    seedBtn.addEventListener('click', seedSampleDocuments)
  }

  loadDocs()
}

setup()

