/**
 * Text rules shared by the web forms and the API's DTOs (ADR-0017).
 */

/**
 * Single-line text: no control characters. PostgreSQL rejects NUL in `text`,
 * which would otherwise surface as a 500, and names never need line breaks.
 */
export const NO_CONTROL_CHARACTERS_PATTERN = /^[^\u0000-\u001F\u007F]*$/;
