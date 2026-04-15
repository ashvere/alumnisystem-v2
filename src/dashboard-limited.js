import { supabase } from './supabase.js'
import Chart from 'chart.js/auto'
import { getCurrentUser } from './auth.js'
import { createIcons, icons } from 'lucide'

function page() {
  const p = window.location.pathname
  if (p.endsWith('/dashboard/osa.html')) return 'osa'
  if (p.endsWith('/dashboard/registrar.html')) return 'registrar'
  if (p.endsWith('/dashboard/campus-admin.html')) return 'campus_admin'
  if (p.endsWith('/dashboard/department.html')) return 'department'
  return 'unknown'
}

async function loadEmploymentChart(filterCourse) {
  let q = supabase.from('alumni').select('employment_status, course')
  if (filterCourse) q = q.eq('course', filterCourse)

  const { data } = await q

  const statuses = ['Employed', 'Unemployed', 'Self-Employed', 'Abroad', 'Further Studies']
  const counts = Object.fromEntries(statuses.map((s) => [s, 0]))
  ;(data || []).forEach((a) => {
    if (a.employment_status && counts[a.employment_status] !== undefined) counts[a.employment_status]++
  })

  const canvas = document.getElementById('employmentChart')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [
        {
          data: Object.values(counts),
          backgroundColor: ['#1e3a8a', '#facc15', '#3b82f6', '#94a3b8', '#22c55e'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  })
}

async function loadYearlyChart(filterCourse) {
  let q = supabase.from('alumni').select('graduation_year, course')
  if (filterCourse) q = q.eq('course', filterCourse)
  const { data } = await q

  const yearly = {}
  ;(data || []).forEach((a) => {
    if (!a.graduation_year) return
    yearly[a.graduation_year] = (yearly[a.graduation_year] || 0) + 1
  })

  const years = Object.keys(yearly).sort()
  const counts = years.map((y) => yearly[y])

  const canvas = document.getElementById('yearlyChart')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Alumni per Year',
          data: counts,
          borderColor: '#1e3a8a',
          backgroundColor: 'rgba(30, 58, 138, 0.10)',
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: { responsive: true },
  })
}

async function initOSA() {
  createIcons({ icons })
  const { data: events } = await supabase
    .from('events')
    .select('attended, donated, mentorship_participated')

  const eventsLogged = (events || []).filter((e) => e.attended === true).length
  const donationsLogged = (events || []).filter((e) => e.donated === true).length
  const mentorshipLogged = (events || []).filter((e) => e.mentorship_participated === true).length

  document.getElementById('eventsLogged').textContent = eventsLogged
  document.getElementById('donationsLogged').textContent = donationsLogged
  document.getElementById('mentorshipLogged').textContent = mentorshipLogged

  const canvas = document.getElementById('engagementChart')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Events', 'Donations', 'Mentorship'],
      datasets: [
        {
          label: 'Count',
          data: [eventsLogged, donationsLogged, mentorshipLogged],
          backgroundColor: ['#1e3a8a', '#facc15', '#3b82f6'],
          borderRadius: 10,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  })

  const wire = (id, mode) => {
    const el = document.getElementById(id)
    if (!el) return
    const go = () => (window.location.href = `/shared/events.html?mode=${mode}`)
    el.addEventListener('click', go)
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') go()
    })
  }
  wire('eventsCard', 'events')
  wire('donationsCard', 'donations')
  wire('mentorshipCard', 'mentorship')
}

async function initRegistrar() {
  createIcons({ icons })
  const { data: alumni } = await supabase.from('alumni').select('id')
  const { data: docs } = await supabase.from('alumni_documents').select('verified')

  document.getElementById('totalAlumni').textContent = alumni?.length || 0
  document.getElementById('recordsUploaded').textContent = docs?.length || 0
  document.getElementById('verifiedDocs').textContent = (docs || []).filter((d) => d.verified === true).length

  await loadYearlyChart()

  const wire = (id, to) => {
    const el = document.getElementById(id)
    if (!el) return
    const go = () => (window.location.href = to)
    el.addEventListener('click', go)
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') go()
    })
  }

  wire('registrarRecordsCard', '/shared/documents.html')
  wire('registrarVerifiedCard', '/shared/documents.html')
  wire('registrarTotalAlumniCard', '/shared/alumni-management.html')
}

async function initCampusAdmin() {
  createIcons({ icons })
  const { data: alumni } = await supabase.from('alumni').select('id')
  const { data: docs } = await supabase.from('alumni_documents').select('id')
  const { data: events } = await supabase.from('events').select('id')

  const totalEl = document.getElementById('totalAlumni')
  if (totalEl) totalEl.textContent = alumni?.length || 0
  const docsEl = document.getElementById('docsUploaded')
  if (docsEl) docsEl.textContent = docs?.length || 0
  const engageEl = document.getElementById('engagementLogs')
  if (engageEl) engageEl.textContent = events?.length || 0

  await loadYearlyChart()
  await loadEmploymentChart()

  const wire = (id, to) => {
    const el = document.getElementById(id)
    if (!el) return
    const go = () => (window.location.href = to)
    el.addEventListener('click', go)
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') go()
    })
  }

  wire('campusTotalAlumniCard', '/shared/alumni-management.html')
  wire('campusDocsCard', '/shared/documents.html')
  wire('campusEngagementCard', '/shared/events.html?mode=events')
}

async function initDepartment() {
  createIcons({ icons })
  const user = getCurrentUser()
  const program = user?.department
  if (!program) return

  const { data: alumni } = await supabase
    .from('alumni')
    .select('employment_status')
    .eq('course', program)

  const { data: docs } = await supabase
    .from('alumni_documents')
    .select('id, alumni_id, alumni:alumni(course)')

  document.getElementById('programAlumni').textContent = alumni?.length || 0

  const employed = (alumni || []).filter((a) => a.employment_status === 'Employed').length
  const rate = alumni?.length ? ((employed / alumni.length) * 100).toFixed(1) : '0.0'
  document.getElementById('programEmploymentRate').textContent = `${rate}%`

  // docs count filtered by alumni course (best-effort; requires foreign table select support)
  const programDocs = (docs || []).filter((d) => d.alumni?.course === program).length
  document.getElementById('programDocs').textContent = programDocs

  await loadYearlyChart(program)
  await loadEmploymentChart(program)
}

async function init() {
  const user = getCurrentUser()
  if (!user) {
    window.location.href = '/index.html'
    return
  }

  switch (page()) {
    case 'osa':
      await initOSA()
      break
    case 'registrar':
      await initRegistrar()
      break
    case 'campus_admin':
      await initCampusAdmin()
      break
    case 'department':
      await initDepartment()
      break
    default:
      break
  }
}

init()

