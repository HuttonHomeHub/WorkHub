import { randomUUID } from 'node:crypto';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { ExportError } from './export';

/**
 * Write the export so that only its owner can read it, whatever was there
 * before (security review, slice 8):
 *
 * - without `force`, the file is created exclusively (`O_CREAT|O_EXCL`,
 *   mode 0600): an existing file — or a symlink — at the path is refused, with
 *   no gap between checking and writing;
 * - with `force`, it is written the same way to a new temporary file beside
 *   the target and renamed over it, so the result is always a fresh 0600 file
 *   and a failed write never leaves half an export.
 */
export function writeExportFile(path: string, text: string, force: boolean): void {
  if (!force) {
    try {
      writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new ExportError(`${path} already exists. Pass --force to overwrite it.`);
      }
      throw error;
    }
    return;
  }
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, text, { flag: 'wx', mode: 0o600 });
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}
