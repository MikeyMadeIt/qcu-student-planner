// Front-end configuration (ES module). Contains no secrets.
export const APP_CONFIG = Object.freeze({
    appName: 'QCU Student Planner',
    passwordMinLength: 8,
    registrationOptionsUrl: '../../assets/data/registration-options.json',
    registrationPreviewFlag: 'qcu.registrationPreview',
    supabaseUrl: 'https://pjafmgabajqqozdxhzvz.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYWZtZ2FiYWpxcW96ZHhoenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDY4MDQsImV4cCI6MjEwODMyMjgwNH0.jl69ZxsYdz0jBkOI5wbWTSlXtYeOoCtxHakUcW_wFzE',
    studentEmailPattern: /^[a-z]+(?:-[a-z]+)*\.[a-z]+(?:-[a-z]+)*\.[a-z]+(?:-[a-z]+)*@gmail\.com$/i,
    routes: Object.freeze({
        login: 'login.html',
        register: 'register.html',
        pending: 'pending.html',
        verify: 'verify.html',
        callback: 'callback.html',
        finishProfile: 'finish-profile.html',
        forgotPassword: 'forgot-password.html',
        resetPassword: 'reset-password.html',
        dashboard: '../app/dashboard.html',
    }),
    adminRoutes: Object.freeze({
        dashboard: 'dashboard.html',
        verification: 'verification.html',
        users: 'users.html',
        activityLog: 'activity-log.html',
    }),
});
