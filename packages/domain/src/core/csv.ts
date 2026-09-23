/**
 * A small, safe CSV writer (RFC 4180): comma-separated, CRLF line endings,
 * fields quoted when they contain a comma, quote or line break.
 *
 * **Formula-injection guard** (OWASP "CSV injection"): a text cell starting
 * with `=`, `+`, `-`, `@`, a tab, a carriage return, a line feed, or a
 * full-width `＝＋－＠` is prefixed with `'`, so a spreadsheet shows it as text
 * instead of running it. A cell containing `;` is quoted too, so a
 * semicolon-separated reading (some Excel locales) cannot split out a formula.
 * Numbers are written as numbers and never prefixed.
 */
export type CsvCell = string | number | null;

const FORMULA_START = /^[=+\-@\t\r\n\uFF1D\uFF0B\uFF0D\uFF20]/;

function cell(value: CsvCell): string {
  if (value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Rows to CSV text. With `bom` (the default), the text starts with a UTF-8
 * byte-order mark, so Excel reads non-ASCII text (the minus sign in `−2:00`)
 * correctly.
 */
export function toCsv(rows: readonly (readonly CsvCell[])[], { bom = true } = {}): string {
  const body = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  return `${bom ? '\uFEFF' : ''}${body}\r\n`;
}
