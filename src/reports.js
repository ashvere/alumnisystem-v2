import { supabase } from './supabase.js'

export async function generateEmploymentReport() {
  const { data } = await supabase.from('alumni').select('employment_status, course')

  const report = {
    total: data.length,
    employed: data.filter((a) => a.employment_status === 'Employed').length,
    unemployed: data.filter((a) => a.employment_status === 'Unemployed').length,
    selfEmployed: data.filter((a) => a.employment_status === 'Self-Employed').length,
    abroad: data.filter((a) => a.employment_status === 'Abroad').length,
  }

  return report
}

export async function generateProgramReport() {
  const { data } = await supabase.from('alumni').select('course, employment_status')

  const programStats = {}
  data.forEach((alumnus) => {
    if (!programStats[alumnus.course]) {
      programStats[alumnus.course] = { total: 0, employed: 0 }
    }
    programStats[alumnus.course].total++
    if (alumnus.employment_status === 'Employed') {
      programStats[alumnus.course].employed++
    }
  })

  return Object.entries(programStats).map(([course, stats]) => ({
    course,
    total: stats.total,
    employed: stats.employed,
    rate: ((stats.employed / stats.total) * 100).toFixed(1),
  }))
}

