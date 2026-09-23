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
  // Revoke after the click has been handled, so the browser has the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
