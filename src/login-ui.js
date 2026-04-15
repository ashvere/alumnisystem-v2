function setIcon(el, mode) {
  // mode: 'show' (eye) or 'hide' (eye-off)
  el.innerHTML =
    mode === 'show'
      ? `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      `
      : `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-4.3 5.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.6 6.6A18.7 18.7 0 0 0 2 12s3.5 7 10 7c1.1 0 2.1-.2 3-.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 2l20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `
}

function setupPasswordToggle() {
  const input = document.getElementById('password')
  const btn = document.getElementById('togglePassword')
  const icon = btn?.querySelector('.password-toggle-icon')
  if (!input || !btn || !icon) return

  const apply = (visible) => {
    input.type = visible ? 'text' : 'password'
    btn.setAttribute('aria-pressed', visible ? 'true' : 'false')
    btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password')
    setIcon(icon, visible ? 'hide' : 'show')
  }

  apply(false)

  btn.addEventListener('click', () => {
    const visible = input.type === 'text'
    apply(!visible)
    input.focus()
  })
}

setupPasswordToggle()

function setupStudentRoleUI() {
  const roleSelect = document.getElementById('roleSelect')
  const passwordGroup = document.getElementById('password')?.closest('.input-group')
  const passwordInput = document.getElementById('password')
  if (!roleSelect || !passwordGroup || !passwordInput) return

  const applyRole = () => {
    const role = roleSelect.value
    const isStudent = role === 'student'
    passwordGroup.style.display = isStudent ? 'none' : ''
    if (isStudent) passwordInput.value = ''
  }

  roleSelect.addEventListener('change', applyRole)
  applyRole()
}

setupStudentRoleUI()

