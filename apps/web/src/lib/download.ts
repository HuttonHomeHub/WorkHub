/** How long the file's object URL lives after the click. */
export const REVOKE_AFTER_MS = 10_000;

/**
 * Saves text built in the browser as a file (a CSV export): a Blob, and a
 * temporary link with `download`, clicked and removed. Nothing is sent to the
 * server.
 */
export function downloadText(
  filename: string,
  text: string,
  type = 'text/csv;charset=utf-8',
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke once the browser has surely read the file: a slow disk or a
  // "Save as" prompt can still be reading it after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
