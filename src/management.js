import { supabase } from './supabase.js'
import { getCurrentUser, logout } from './auth.js'
import { createIcons, icons } from 'lucide'

let currentPage = 1
let currentData = []
const itemsPerPage = 10

const user = getCurrentUser()
if (!user) window.location.href = '/index.html'

document.getElementById('logoutBtn')?.addEventListener('click', logout)

async function loadAlumni() {
  createIcons({ icons })
  let query = supabase.from('alumni').select('*')

  const year = document.getElementById('yearFilter').value
  const course = document.getElementById('courseFilter').value
  const employment = document.getElementById('employmentFilter').value
  const city = document.getElementById('cityFilter').value
  const company = document.getElementById('companyFilter').value
  const batch = document.getElementById('batchFilter').value
  const search = document.getElementById('searchInput').value

  if (year) query = query.eq('graduation_year', parseInt(year))
  if (course) query = query.eq('course', course)
  if (employment) query = query.eq('employment_status', employment)
  if (city) query = query.eq('current_city', city)
  if (company) query = query.eq('current_company', company)
  if (batch) query = query.eq('batch', batch)
  if (search) query = query.ilike('full_name', `%${search}%`)

  const { data, error } = await query
  if (!error) {
    currentData = data || []
    renderTable()
    renderPagination()
    populateFilters(currentData)
    createIcons({ icons })
  }
}

function renderTable() {
  const start = (currentPage - 1) * itemsPerPage
  const end = start + itemsPerPage
  const pageData = currentData.slice(start, end)

  const tbody = document.getElementById('alumniTableBody')
  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">No alumni found</td></tr>'
    return
  }

  tbody.innerHTML = pageData
    .map(
      (alumnus) => `
    <tr>
      <td>${alumnus.full_name || ''}</td>
      <td>${alumnus.graduation_year || ''}</td>
      <td>${alumnus.course || ''}</td>
      <td>${alumnus.batch || ''}</td>
      <td><span class="status-badge status-${alumnus.employment_status?.toLowerCase()}">${alumnus.employment_status || 'N/A'}</span></td>
      <td>${alumnus.current_company || 'N/A'}</td>
      <td>${alumnus.current_city || 'N/A'}</td>
      <td>
        <span class="location-pill">
          <i data-lucide="${alumnus.is_local ? 'map-pin' : 'globe'}" aria-hidden="true"></i>
          ${alumnus.is_local ? 'Local' : 'International'}
        </span>
      </td>
    </tr>
  `,
    )
    .join('')

  createIcons({ icons })
}

function renderPagination() {
  const totalPages = Math.ceil(currentData.length / itemsPerPage) || 1
  const pagination = document.getElementById('pagination')

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

async function populateFilters(data) {
  const years = [...new Set(data.map((a) => a.graduation_year).filter((y) => y))]
  years.sort()
  populateSelect(document.getElementById('yearFilter'), years)

  const courses = [...new Set(data.map((a) => a.course).filter((c) => c))]
  populateSelect(document.getElementById('courseFilter'), courses)

  const cities = [...new Set(data.map((a) => a.current_city).filter((c) => c))]
  populateSelect(document.getElementById('cityFilter'), cities)

  const companies = [...new Set(data.map((a) => a.current_company).filter((c) => c))]
  populateSelect(document.getElementById('companyFilter'), companies)

  const batches = [...new Set(data.map((a) => a.batch).filter((b) => b))]
  populateSelect(document.getElementById('batchFilter'), batches)
}

document.getElementById('yearFilter')?.addEventListener('change', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('courseFilter')?.addEventListener('change', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('employmentFilter')?.addEventListener('change', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('cityFilter')?.addEventListener('change', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('companyFilter')?.addEventListener('change', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('batchFilter')?.addEventListener('change', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('searchInput')?.addEventListener('input', () => {
  currentPage = 1
  loadAlumni()
})
document.getElementById('resetFilters')?.addEventListener('click', () => {
  document
    .querySelectorAll('.filters-bar select, .filters-bar input')
    .forEach((el) => (el.value = ''))
  currentPage = 1
  loadAlumni()
})

document.getElementById('exportPDF')?.addEventListener('click', () => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`
    <html>
      <head><title>Alumni Report</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #1e3a8a; color: white; }
      </style>
      </head>
      <body>
        <h1>WVSU Alumni Report</h1>
        <table>${document.getElementById('alumniTable').outerHTML}</table>
      </body>
    </html>
  `)
  printWindow.print()
})

document.getElementById('exportExcel')?.addEventListener('click', () => {
  const table = document.getElementById('alumniTable')
  const csv = []
  const rows = table.querySelectorAll('tr')

  rows.forEach((row) => {
    const rowData = []
    row.querySelectorAll('th, td').forEach((cell) => {
      rowData.push(cell.innerText)
    })
    csv.push(rowData.join(','))
  })

  const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'alumni_report.csv'
  a.click()
  URL.revokeObjectURL(url)
})

// logout handled via auth.js

loadAlumni()

