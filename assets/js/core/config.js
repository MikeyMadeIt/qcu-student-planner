/* Front-end configuration (ES module). Contains no secrets. */
export const APP_CONFIG = Object.freeze({
    appName: 'QCU Student Planner',
    passwordMinLength: 8,
    registrationOptionsUrl: '../../assets/data/registration-options.json',
    registrationPreviewFlag: 'qcu.registrationPreview',
    /* Supabase project credentials. The anon/public key is designed to be exposed in
       browser code — it only works through Row Level Security, never bypasses it.
       NEVER put the service_role key here or anywhere in frontend code. */
    supabaseUrl: 'https://pjafmgabajqqozdxhzvz.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYWZtZ2FiYWpxcW96ZHhoenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDY4MDQsImV4cCI6MjEwODMyMjgwNH0.jl69ZxsYdz0jBkOI5wbWTSlXtYeOoCtxHakUcW_wFzE',
    /* The exact Gmail format our university assigns students, enforced only as a visual
       hint for admins reviewing an account (see pages/admin/verification.html) -- Supabase
       has no way to enforce this at the Google OAuth layer itself, so every Google sign-in
       still lands as 'pending' and a human makes the final call. */
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
