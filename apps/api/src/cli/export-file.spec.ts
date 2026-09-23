import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ExportError } from './export';
import { writeExportFile } from './export-file';

const mode = (path: string) => statSync(path).mode & 0o777;

describe('writeExportFile', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'export-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('creates a file readable by its owner only', () => {
    const path = join(dir, 'out.json');
    writeExportFile(path, '{}', false);
    expect(mode(path)).toBe(0o600);
  });

  it('refuses an existing file, or a symlink, without --force', () => {
    const path = join(dir, 'out.json');
    writeFileSync(path, 'old');
    expect(() => writeExportFile(path, '{}', false)).toThrow(ExportError);
    expect(readFileSync(path, 'utf8')).toBe('old');

    const link = join(dir, 'link.json');
    symlinkSync(join(dir, 'target.json'), link);
    expect(() => writeExportFile(link, '{}', false)).toThrow(ExportError);
  });

  it('replaces a world-readable file with a fresh 0600 one under --force', () => {
    const path = join(dir, 'out.json');
    writeFileSync(path, 'old');
    chmodSync(path, 0o644);
    writeExportFile(path, '{"new":true}', true);
    expect(readFileSync(path, 'utf8')).toBe('{"new":true}');
    expect(mode(path)).toBe(0o600);
  });
});
