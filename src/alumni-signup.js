import { supabase } from './supabase.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function setStatus(msg, isError = false) {
  const targets = [document.getElementById('verifyStatus'), document.getElementById('signupStatus')].filter(
    Boolean,
  )
  if (targets.length === 0) return
  targets.forEach((el) => {
    el.style.color = isError ? '#b91c1c' : ''
    el.innerHTML = msg
  })
}

function setStep(step) {
  const step1 = document.getElementById('step1')
  const step2 = document.getElementById('step2')
  const pill1 = document.getElementById('step1Pill')
  const pill2 = document.getElementById('step2Pill')
  if (!step1 || !step2 || !pill1 || !pill2) return

  const isStep2 = step === 2
  step1.style.display = isStep2 ? 'none' : ''
  step2.style.display = isStep2 ? '' : 'none'
  pill1.classList.toggle('active', !isStep2)
  pill2.classList.toggle('active', isStep2)
}

const COOLDOWN_SECONDS = 60
const COOLDOWN_KEY = 'alumni_signup_verify_cooldown_until_ms'

function setCooldown(untilMs) {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(untilMs))
  } catch {
    // ignore
  }
}

function getCooldownUntil() {
  try {
    const raw = sessionStorage.getItem(COOLDOWN_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function startCooldownTicker() {
  const btn = document.getElementById('sendVerifyBtn')
  if (!btn) return

  const tick = () => {
    const until = getCooldownUntil()
    const remainingMs = until - Date.now()
    if (remainingMs <= 0) {
      btn.disabled = false
      btn.textContent = 'Send'
      return
    }

    const secs = Math.ceil(remainingMs / 1000)
    btn.disabled = true
    btn.textContent = `Resend in ${secs}s`
    window.setTimeout(tick, 250)
  }

  tick()
}

async function refreshVerifiedState() {
  const { data } = await supabase.auth.getSession()
  const email = data?.session?.user?.email
  const isVerified = Boolean(email)

  const btn = document.getElementById('completeSignupBtn')
  if (btn) btn.disabled = !isVerified

  const continueBtn = document.getElementById('continueBtn')
  if (continueBtn) continueBtn.disabled = !isVerified

  if (isVerified) {
    const input = document.getElementById('signupEmail')
    if (input && !input.value) input.value = email
    setStatus(`Verified as <strong>${escapeHtml(email)}</strong>. You can complete sign up now.`)

    const badge = document.getElementById('verifiedBadge')
    if (badge) badge.style.display = ''
  }

  return { isVerified, email }
}

async function sendVerification() {
  // Enforce cooldown (protect against rate limits)
  const until = getCooldownUntil()
  if (until && until > Date.now()) {
    startCooldownTicker()
    return
  }

  const email = document.getElementById('signupEmail')?.value?.trim()
  if (!email) {
    setStatus('Please enter your email.', true)
    return
  }

  const btn = document.getElementById('sendVerifyBtn')
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Sending...'
  }

  const redirectTo = `${window.location.origin}/shared/alumni-signup.html`
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })

  if (btn) {
    btn.disabled = false
    btn.textContent = 'Send verification'
  }

  if (error) {
    setStatus(`Failed to send verification: ${escapeHtml(error.message)}`, true)
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Send'
    }
    return
  }

  setCooldown(Date.now() + COOLDOWN_SECONDS * 1000)
  startCooldownTicker()

  setStatus(
    `Verification link sent to <strong>${escapeHtml(email)}</strong>. Check your inbox/spam, then click the link.`,
  )
}

async function completeSignup(e) {
  e.preventDefault()

  const { isVerified, email } = await refreshVerifiedState()
  if (!isVerified || !email) {
    setStatus('Please verify your email first.', true)
    return
  }

  const payload = {
    student_id: document.getElementById('signupStudentId')?.value?.trim(),
    full_name: document.getElementById('signupFullName')?.value?.trim(),
    graduation_year: Number(document.getElementById('signupGradYear')?.value),
    course: document.getElementById('signupCourse')?.value?.trim(),
    email,
    contact_number: document.getElementById('signupContact')?.value?.trim() || null,
    employment_status: document.getElementById('signupEmployment')?.value || null,
    created_at: new Date(),
  }

  if (!payload.student_id || !payload.full_name || !payload.graduation_year || !payload.course) {
    setStatus('Please complete all required fields.', true)
    return
  }

  const submitBtn = document.getElementById('completeSignupBtn')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'Saving...'
  }

  // Create alumni row (requires table + permissions/RLS)
  const { data: inserted, error } = await supabase
    .from('alumni')
    .insert(payload)
    .select('id, full_name, email')
    .limit(1)

  if (submitBtn) {
    submitBtn.disabled = false
    submitBtn.textContent = 'Complete sign up'
  }

  if (error) {
    setStatus(`Failed to create alumni record: ${escapeHtml(error.message)}`, true)
    return
  }

  const row = inserted?.[0]
  if (row?.id) {
    // Create local session so student dashboard doesn't redirect to login.
    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: row.id,
        username: row.email || email,
        email: row.email || email,
        full_name: row.full_name || '',
        role: 'student',
        department: null,
        permissions: {
          canEdit: false,
          canUpload: false,
          canViewAll: false,
          canGenerateReports: false,
        },
      }),
    )
  }

  setStatus('Sign up complete. Opening your profile…')
  window.setTimeout(() => {
    window.location.href = '/dashboard/student.html'
  }, 900)
}

document.getElementById('sendVerifyBtn')?.addEventListener('click', sendVerification)
document.getElementById('alumniSignupForm')?.addEventListener('submit', completeSignup)
document.getElementById('continueBtn')?.addEventListener('click', async () => {
  const { isVerified } = await refreshVerifiedState()
  if (isVerified) setStep(2)
})
document.getElementById('backToStep1Btn')?.addEventListener('click', () => setStep(1))

// If user just returned from email link, hydrate state
setStep(1)
startCooldownTicker()
refreshVerifiedState()
  .then(({ isVerified }) => {
    if (isVerified) setStep(2)
  })
  .catch(() => {})

