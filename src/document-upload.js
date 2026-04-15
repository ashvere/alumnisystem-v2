import { supabase } from './supabase.js'
import { getCurrentUser, hasPermission } from './auth.js'
import { createIcons, icons } from 'lucide'

const STORAGE_BUCKET = 'alumni-documents'

export async function uploadDocument(alumniId, file, documentType, academicYear, semester) {
  const user = getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  const fileExt = file.name.split('.').pop()
  const safeType = String(documentType).replaceAll(/\s+/g, '_')
  const objectPath = `${alumniId}/${Date.now()}_${safeType}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (uploadError) throw uploadError

  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath)
  const publicUrl = publicData?.publicUrl
  if (!publicUrl) throw new Error('Failed to generate file URL')

  const { data: inserted, error: dbError } = await supabase
    .from('alumni_documents')
    .insert({
      alumni_id: alumniId,
      document_type: documentType,
      file_name: file.name,
      file_url: publicUrl,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
      academic_year: academicYear || null,
      semester: semester || null,
    })
    .select()
    .limit(1)

  if (dbError) throw dbError
  return inserted?.[0]
}

export function setupUploadModal() {
  const modal = document.getElementById('uploadModal')
  const closeBtn = document.querySelector('.modal-close-upload')
  const cancelBtn = document.getElementById('cancelUpload')
  const form = document.getElementById('uploadDocumentForm')
  const typeSelect = document.getElementById('documentType')
  const academicYearInput = document.getElementById('academicYear')
  const semesterSelect = document.getElementById('semester')
  const fileInput = document.getElementById('documentFile')

  if (!modal || !form) return

  const defaultAccept = fileInput?.getAttribute('accept') || ''

  function resetOverrides() {
    if (typeSelect) typeSelect.disabled = false
    if (academicYearInput) academicYearInput.disabled = false
    if (semesterSelect) semesterSelect.disabled = false
    if (fileInput && defaultAccept) fileInput.setAttribute('accept', defaultAccept)
  }

  window.openUploadModal = (alumniId, options = null) => {
    if (!hasPermission('canUpload')) {
      alert('You do not have permission to upload documents')
      return
    }

    resetOverrides()
    document.getElementById('uploadAlumniId').value = alumniId

    if (options?.presetType && typeSelect) {
      typeSelect.value = options.presetType
      typeSelect.disabled = true
    }
    if (options?.accept && fileInput) {
      fileInput.setAttribute('accept', options.accept)
    }
    if (options?.hideAcademic === true) {
      if (academicYearInput) academicYearInput.value = ''
      if (semesterSelect) semesterSelect.value = '1st'
      if (academicYearInput) academicYearInput.disabled = true
      if (semesterSelect) semesterSelect.disabled = true
    }

    modal.style.display = 'block'
    modal.setAttribute('aria-hidden', 'false')
    createIcons({ icons })
  }

  const close = () => {
    modal.style.display = 'none'
    modal.setAttribute('aria-hidden', 'true')
    form.reset()
    resetOverrides()
  }

  closeBtn?.addEventListener('click', close)
  cancelBtn?.addEventListener('click', close)

  window.addEventListener('click', (event) => {
    if (event.target === modal) close()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    if (!hasPermission('canUpload')) {
      alert('You do not have permission to upload documents')
      return
    }

    const alumniId = document.getElementById('uploadAlumniId').value
    const documentType = document.getElementById('documentType').value
    const academicYear = document.getElementById('academicYear').value
    const semester = document.getElementById('semester').value
    const file = document.getElementById('documentFile').files?.[0]

    if (!file) {
      alert('Please select a file')
      return
    }

    const submitBtn = document.getElementById('uploadSubmitBtn')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = 'Uploading...'
    }

    try {
      await uploadDocument(alumniId, file, documentType, academicYear, semester)
      close()
      alert('Document uploaded successfully.')
    } catch (err) {
      console.error(err)
      alert(`Failed to upload: ${err?.message || err}`)
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Upload'
      }
    }
  })
}

