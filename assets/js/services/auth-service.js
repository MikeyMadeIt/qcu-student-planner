/* Authentication service boundary (ES module).
   Backend integration point: replace the body of each function with the real auth provider call.
   Until then every call reports that the service is not connected. It never fabricates a success. */

export const AUTH_NOT_CONFIGURED = 'AUTH_NOT_CONFIGURED';

const NOT_CONFIGURED = Object.freeze({
    ok: false,
    code: AUTH_NOT_CONFIGURED,
    message: 'The authentication service is not connected yet, so this request could not be processed.',
});

export const AuthService = {
    async signIn( /* { email, password } */) {
        return NOT_CONFIGURED;
    },

    async signUp( /* { email, password, program, campus, yearLevel, acceptedTerms, acknowledgedPrivacy } */) {
        return NOT_CONFIGURED;
    },

    async requestPasswordReset( /* { email } */) {
        return NOT_CONFIGURED;
    },

    async updatePassword( /* { password } */) {
        return NOT_CONFIGURED;
    },

    async checkVerificationStatus() {
        return NOT_CONFIGURED;
    },

    async confirmEmail( /* { token } */) {
        return NOT_CONFIGURED;
    },
};
