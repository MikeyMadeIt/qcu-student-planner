/* Front-end configuration (ES module). Contains no secrets. */
export const APP_CONFIG = Object.freeze({
    appName: 'QCU Student Planner',
    passwordMinLength: 8,
    registrationOptionsUrl: '../../assets/data/registration-options.json',
    registrationPreviewFlag: 'qcu.registrationPreview',
    routes: Object.freeze({
        login: 'login.html',
        register: 'register.html',
        pending: 'pending.html',
        verify: 'verify.html',
        forgotPassword: 'forgot-password.html',
        resetPassword: 'reset-password.html',
    }),
});
