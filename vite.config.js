import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        // legacy pages (kept)
        directorDashboard: resolve(__dirname, 'director/dashboard.html'),
        directorManagement: resolve(__dirname, 'director/management.html'),

        // multi-role pages
        director: resolve(__dirname, 'dashboard/director.html'),
        daa: resolve(__dirname, 'dashboard/daa.html'),
        osa: resolve(__dirname, 'dashboard/osa.html'),
        registrar: resolve(__dirname, 'dashboard/registrar.html'),
        campusAdmin: resolve(__dirname, 'dashboard/campus-admin.html'),
        department: resolve(__dirname, 'dashboard/department.html'),
        student: resolve(__dirname, 'dashboard/student.html'),

        // shared
        alumniManagement: resolve(__dirname, 'shared/alumni-management.html'),
        events: resolve(__dirname, 'shared/events.html'),
        documents: resolve(__dirname, 'shared/documents.html'),
        alumniSignup: resolve(__dirname, 'shared/alumni-signup.html'),
      },
    },
  },
})

