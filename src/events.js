import { supabase } from './supabase.js'
import { getCurrentUser, logout } from './auth.js'
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

function getMode() {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  return mode === 'donations' || mode === 'mentorship' || mode === 'events' ? mode : 'events'
}

function getTitle(mode) {
  if (mode === 'donations') return 'Donations'
  if (mode === 'mentorship') return 'Mentorship'
  return 'Events'
}

async function loadEvents() {
  const tbody = document.getElementById('eventsTbody')
  const thead = document.getElementById('eventsThead')
  const q = (document.getElementById('eventSearch')?.value || '').trim().toLowerCase()
  if (!tbody || !thead) return

  const mode = getMode()
  const title = getTitle(mode)
  document.getElementById('eventsTitle').textContent = title

  // Note: do NOT order by a column that may not exist (would throw).
  const { data, error } = await supabase.from('events').select('*').limit(500)
  if (error) {
    console.error(error)
    thead.innerHTML = ''
    tbody.innerHTML = `<tr><td>
      Failed to load ${escapeHtml(title.toLowerCase())}.<br/>
      <span class="muted">${escapeHtml(error.message || String(error))}</span>
    </td></tr>`
    return
  }

  let rows = data || []

  // Client-side sorting when timestamp exists
  if (rows.length && 'created_at' in rows[0]) {
    rows = rows
      .slice()
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  }

  // Optional filtering based on known boolean columns
  if (mode === 'events' && rows.length && 'attended' in rows[0]) {
    rows = rows.filter((r) => r.attended === true)
  }
  if (mode === 'donations' && rows.length && 'donated' in rows[0]) {
    rows = rows.filter((r) => r.donated === true)
  }
  if (mode === 'mentorship' && rows.length && 'mentorship_participated' in rows[0]) {
    rows = rows.filter((r) => r.mentorship_participated === true)
  }

  if (q) {
    rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }

  document.getElementById('eventsSubtitle').textContent = ` • ${rows.length} record(s)`

  if (!rows.length) {
    thead.innerHTML = ''
    tbody.innerHTML = `<tr><td>No ${escapeHtml(title.toLowerCase())} found.</td></tr>`
    return
  }

  const preferred = [
    'created_at',
    'event_date',
    'date',
    'title',
    'name',
    'description',
    'attended',
    'donated',
    'mentorship_participated',
    'alumni_id',
    'student_id',
    'full_name',
  ]
  const keys = Object.keys(rows[0])
  const ordered = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)),
  ]

  thead.innerHTML = `<tr>${ordered.map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr>`

  tbody.innerHTML = rows
    .map((r) => {
      return `<tr>${ordered
        .map((k) => {
          const v = r[k]
          if (typeof v === 'string' && v.startsWith('http')) {
            return `<td><a href="${escapeHtml(v)}" target="_blank" rel="noreferrer">Open</a></td>`
          }
          if (typeof v === 'boolean') return `<td>${v ? 'Yes' : 'No'}</td>`
          if (v === null || v === undefined) return `<td>—</td>`
          return `<td>${escapeHtml(v)}</td>`
        })
        .join('')}</tr>`
    })
    .join('')
}

function printTable() {
  const title = document.getElementById('eventsTitle')?.textContent || 'Events'
  const table = document.getElementById('eventsTable')
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
        <title>${escapeHtml(title)}</title>
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
        <h1>${escapeHtml(title)}</h1>
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
  document.getElementById('refreshEvents')?.addEventListener('click', loadEvents)
  document.getElementById('eventSearch')?.addEventListener('input', loadEvents)
  document.getElementById('printEventsBtn')?.addEventListener('click', printTable)

  loadEvents()
}

setup()

