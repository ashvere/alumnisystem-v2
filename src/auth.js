import { supabase } from './supabase.js'
import { roleDashboards, rolePermissions } from './roles.js'

const DEFAULT_PASSWORD = 'WVSU@1234'
const SESSION_KEY = 'currentUser'

const roleHeadFallbackName = {
  osa: 'Harrace Gem A. Caver',
  director: 'Rosie Jane P. Siosan',
  registrar: 'Eden A. Gadugdug',
  campus_admin: 'Raymund B. Gemora',
}

export function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? JSON.parse(raw) : null
}

export function hasPermission(permission) {
  const user = getCurrentUser()
  if (!user) return false
  return Boolean(rolePermissions[user.role]?.[permission])
}

export function logout() {
  // If a student used Supabase Auth, also sign out there.
  supabase.auth.signOut().catch(() => {})
  localStorage.removeItem(SESSION_KEY)
  window.location.href = '/index.html'
}

function isLoginPage() {
  return window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')
}

function protectRoutes() {
  if (isLoginPage()) return
  const user = getCurrentUser()
  if (!user) {
    window.location.href = '/index.html'
  }
}

protectRoutes()

function setupProfileMenu() {
  const logoutBtn = document.getElementById('logoutBtn')
  if (!logoutBtn) return

  const user = getCurrentUser()

  const wrap = document.createElement('div')
  wrap.className = 'profile-menu-wrap'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'profile-btn'
  btn.setAttribute('aria-label', 'Open profile menu')
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `

  const menu = document.createElement('div')
  menu.className = 'profile-menu'
  const name = user?.full_name || user?.email || user?.username || 'User'
  const sub = [user?.role ? String(user.role).replaceAll('_', ' ') : '', user?.email || '']
    .filter(Boolean)
    .join(' • ')

  menu.innerHTML = `
    <div class="pm-title">${String(name)}</div>
    <div class="pm-sub">${String(sub)}</div>
    <div class="pm-divider"></div>
    <button type="button" class="pm-logout" id="pmLogout">Logout</button>
  `

  const toggle = () => menu.classList.toggle('open')

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggle()
  })

  document.addEventListener('click', () => menu.classList.remove('open'))

  menu.addEventListener('click', (e) => e.stopPropagation())
  menu.querySelector('#pmLogout')?.addEventListener('click', logout)

  wrap.appendChild(btn)
  wrap.appendChild(menu)

  logoutBtn.replaceWith(wrap)
}

setupProfileMenu()

async function tryHydrateStudentSession() {
  const user = getCurrentUser()
  if (user) return

  const { data } = await supabase.auth.getSession()
  const session = data?.session
  const email = session?.user?.email
  if (!email) return

  // Only treat Supabase Auth session as "student" session in this app.
  const studentUser = {
    id: session.user.id,
    username: email,
    email,
    full_name: '',
    role: 'student',
    department: null,
    permissions: rolePermissions.student,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(studentUser))

  // If we are on login page, proceed to student dashboard.
  if (isLoginPage()) {
    window.location.href = roleDashboards.student
  }
}

tryHydrateStudentSession().catch(() => {})

// Login handler (only runs on index.html)
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const role = document.getElementById('roleSelect')?.value
  const email =
    document.getElementById('email')?.value?.trim() ||
    document.getElementById('username')?.value?.trim() // backward-compat (older UI)
  const password = document.getElementById('password')?.value

  if (!role || !email || (role !== 'student' && !password)) {
    alert('Please fill in all fields')
    return
  }

  // Student: send magic link to personal email (Supabase Auth)
  if (role === 'student') {
    const emailRedirectTo = `${window.location.origin}/dashboard/student.html`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
    if (error) {
      alert(`Failed to send authentication email: ${error.message}`)
      return
    }
    alert('Authentication link sent. Please check your email inbox (and spam).')
    return
  }

  // Prefer email-based lookup. If your DB still uses username, this will fall back.
  let { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('role', role)
    .eq('is_active', true)
    .limit(1)

  if ((!users || users.length === 0) && !error) {
    ;({ data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', email)
      .eq('role', role)
      .eq('is_active', true)
      .limit(1))
  }

  if (error || !users || users.length === 0) {
    alert('Invalid credentials. Please check your email, role, and password.')
    return
  }

  const user = users[0]

  // Simple password check (in production, validate password_hash)
  if (password !== DEFAULT_PASSWORD) {
    alert('Invalid password')
    return
  }

  const fullName = user.full_name || roleHeadFallbackName[user.role] || ''

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: user.id,
      username: user.username || user.email || '',
      email: user.email || '',
      full_name: fullName,
      role: user.role,
      department: user.department,
      permissions: rolePermissions[user.role],
    }),
  )

  await supabase.from('users').update({ last_login: new Date() }).eq('id', user.id)

  window.location.href = roleDashboards[user.role]
})

// Logout button handler (dashboards)
document.getElementById('logoutBtn')?.addEventListener('click', logout)

