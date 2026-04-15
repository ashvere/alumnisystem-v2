import { supabase } from './supabase.js'
import Chart from 'chart.js/auto'
import { getCurrentUser, logout } from './auth.js'
import { createIcons, icons } from 'lucide'

const user = getCurrentUser()
if (!user) window.location.href = '/index.html'

document.getElementById('logoutBtn')?.addEventListener('click', logout)

async function initDashboard() {
  createIcons({ icons })
  await loadStats()
  await loadEmploymentChart()
  await loadIndustryChart()
  await loadLocationChart()
  await loadYearlyChart()
  await loadProgramPerformance()
  await loadEngagementMetrics()
  createIcons({ icons })

  const wire = (id, to) => {
    const el = document.getElementById(id)
    if (!el) return
    const go = () => (window.location.href = to)
    el.addEventListener('click', go)
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') go()
    })
  }

  wire('directorTotalAlumniCard', '/shared/alumni-management.html')
  wire('directorEmploymentRateCard', '/shared/alumni-management.html')
  wire('directorActiveEngagementCard', '/shared/events.html?mode=events')
}

async function loadStats() {
  const { data: alumni } = await supabase.from('alumni').select('employment_status')

  document.getElementById('totalAlumni').textContent = alumni?.length || 0

  const employed = alumni?.filter((a) => a.employment_status === 'Employed').length || 0
  const rate = alumni?.length ? ((employed / alumni.length) * 100).toFixed(1) : 0
  document.getElementById('employmentRate').textContent = `${rate}%`

  const { data: events } = await supabase.from('events').select('attended')
  const activeEngagement = events?.filter((e) => e.attended === true).length || 0
  document.getElementById('activeEngagement').textContent = activeEngagement
}

async function loadEmploymentChart() {
  const { data } = await supabase.from('alumni').select('employment_status')

  const counts = {
    Employed: data?.filter((a) => a.employment_status === 'Employed').length || 0,
    Unemployed: data?.filter((a) => a.employment_status === 'Unemployed').length || 0,
    'Self-Employed': data?.filter((a) => a.employment_status === 'Self-Employed').length || 0,
    Abroad: data?.filter((a) => a.employment_status === 'Abroad').length || 0,
  }

  const ctx = document.getElementById('employmentChart').getContext('2d')
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [
        {
          data: Object.values(counts),
          backgroundColor: ['#1e3a8a', '#facc15', '#3b82f6', '#94a3b8'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  })
}

async function loadIndustryChart() {
  const { data } = await supabase.from('alumni').select('current_company')

  const industries = {}
  data?.forEach((alumnus) => {
    if (alumnus.current_company) {
      industries[alumnus.current_company] = (industries[alumnus.current_company] || 0) + 1
    }
  })

  const topIndustries = Object.entries(industries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const ctx = document.getElementById('industryChart').getContext('2d')
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topIndustries.map((i) => i[0]),
      datasets: [
        {
          label: 'Number of Alumni',
          data: topIndustries.map((i) => i[1]),
          backgroundColor: '#1e3a8a',
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  })
}

async function loadLocationChart() {
  const { data } = await supabase.from('alumni').select('is_local')

  const local = data?.filter((a) => a.is_local === true).length || 0
  const international = data?.filter((a) => a.is_local === false).length || 0

  const ctx = document.getElementById('locationChart').getContext('2d')
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Local', 'International'],
      datasets: [
        {
          data: [local, international],
          backgroundColor: ['#1e3a8a', '#facc15'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
    },
  })
}

async function loadYearlyChart() {
  const { data } = await supabase.from('alumni').select('graduation_year')

  const yearly = {}
  data?.forEach((alumnus) => {
    yearly[alumnus.graduation_year] = (yearly[alumnus.graduation_year] || 0) + 1
  })

  const years = Object.keys(yearly).sort()
  const counts = years.map((y) => yearly[y])

  const ctx = document.getElementById('yearlyChart').getContext('2d')
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Alumni per Year',
          data: counts,
          borderColor: '#1e3a8a',
          backgroundColor: 'rgba(30, 58, 138, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
    },
  })
}

async function loadProgramPerformance() {
  const { data } = await supabase.from('alumni').select('course, employment_status')

  const programStats = {}
  data?.forEach((alumnus) => {
    if (!programStats[alumnus.course]) {
      programStats[alumnus.course] = { total: 0, employed: 0 }
    }
    programStats[alumnus.course].total++
    if (alumnus.employment_status === 'Employed') {
      programStats[alumnus.course].employed++
    }
  })

  const programList = document.getElementById('programList')
  const topPerformers = document.getElementById('topPerformers')

  const rates = Object.entries(programStats)
    .map(([course, stats]) => ({
      course,
      rate: (stats.employed / stats.total) * 100,
    }))
    .sort((a, b) => b.rate - a.rate)

  programList.innerHTML =
    '<h4>Employment Rate by Program</h4>' +
    rates
      .map(
        (p) => `
    <div style="margin: 8px 0">
      <strong>${p.course}</strong>: ${p.rate.toFixed(1)}%
      <div style="background: #e2e8f0; height: 4px; border-radius: 2px; margin-top: 4px">
        <div style="background: #1e3a8a; width: ${p.rate}%; height: 4px; border-radius: 2px"></div>
      </div>
    </div>
  `,
      )
      .join('')

  topPerformers.innerHTML =
    '<h4>Top Performing Programs</h4>' +
    rates
      .slice(0, 3)
      .map(
        (p) => `
      <div class="top-performer-item">
        <span class="top-performer-icon" aria-hidden="true"><i data-lucide="award"></i></span>
        <div>
          <div class="top-performer-title">${p.course}</div>
          <div class="top-performer-sub">${p.rate.toFixed(1)}% employment rate</div>
        </div>
      </div>
    `,
      )
      .join('')
}

async function loadEngagementMetrics() {
  const { data } = await supabase
    .from('events')
    .select('attended, donated, mentorship_participated')

  const eventsAttended = data?.filter((e) => e.attended === true).length || 0
  const donated = data?.filter((e) => e.donated === true).length || 0
  const mentorship = data?.filter((e) => e.mentorship_participated === true).length || 0

  document.getElementById('eventsAttended').textContent = eventsAttended
  document.getElementById('donatedCount').textContent = donated
  document.getElementById('mentorshipCount').textContent = mentorship
}

initDashboard()
// logout handled via auth.js

