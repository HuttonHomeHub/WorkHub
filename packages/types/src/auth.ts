/**
 * Account rules shared by the web forms (Zod) and the API's Better Auth
 * configuration, so client and server validation cannot drift (ADR-0017).
 */

/** Minimum password length (Better Auth `minPasswordLength`). */
export const PASSWORD_MIN_LENGTH = 8;

/** Maximum password length (Better Auth `maxPasswordLength`). */
export const PASSWORD_MAX_LENGTH = 128;

/** Maximum length of a user's display name. */
export const USER_NAME_MAX_LENGTH = 120;
