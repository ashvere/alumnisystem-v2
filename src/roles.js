export const roleDashboards = {
  director: '/dashboard/director.html',
  osa: '/dashboard/osa.html',
  registrar: '/dashboard/registrar.html',
  campus_admin: '/dashboard/campus-admin.html',
  department_head: '/dashboard/department.html',
  student: '/dashboard/student.html',
}

export const rolePermissions = {
  director: {
    canEdit: true,
    canUpload: true,
    canViewAll: true,
    canGenerateReports: true,
  },
  osa: { canEdit: true, canUpload: true, canViewAll: true, canGenerateReports: true },
  registrar: {
    canEdit: true,
    canUpload: true,
    canViewAll: true,
    canGenerateReports: true,
  },
  campus_admin: {
    canEdit: true,
    canUpload: true,
    canViewAll: true,
    canGenerateReports: true,
  },
  department_head: {
    canEdit: true,
    canUpload: true,
    canViewAll: false,
    canGenerateReports: true,
  },
  student: {
    canEdit: false,
    canUpload: false,
    canViewAll: false,
    canGenerateReports: false,
  },
}

