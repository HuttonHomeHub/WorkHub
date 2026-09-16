import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PREFERENCES_VERSION, preferenceKey, writePreference } from '@/lib/preferences';

/**
 * `index.html` restores the sidebar state before first paint with an inline
 * script that cannot import `lib/preferences.ts`. These tests keep the two in
 * step, so bumping the preference version or renaming the key can't silently
 * break the pre-paint restore.
 */

const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');

function inlineScript(): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) throw new Error('index.html has no inline pre-paint script');
  return match[1];
}

function runPrePaintScript(): void {
  // The same code the browser runs before the bundle loads.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs a trusted repository file under test
  new Function(inlineScript())();
}

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.sidebar;
  document.documentElement.classList.remove('dark');
});

describe('index.html pre-paint script', () => {
  it('reads the sidebar key and version that lib/preferences.ts writes', () => {
    const script = inlineScript();
    expect(script).toContain(`localStorage.getItem('${preferenceKey('sidebar')}')`);
    expect(script).toContain(`sidebar.version === ${String(PREFERENCES_VERSION)}`);
  });

  it.each([
    [true, 'collapsed'],
    [false, 'expanded'],
  ])('restores collapsed=%s as data-sidebar="%s"', (collapsed, expected) => {
    localStorage.setItem('theme', 'light');
    writePreference('sidebar', { collapsed });
    runPrePaintScript();
    expect(document.documentElement.dataset.sidebar).toBe(expected);
  });

  it('writes only a constant into the DOM, never the stored text', () => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem(
      preferenceKey('sidebar'),
      JSON.stringify({ version: PREFERENCES_VERSION, value: { collapsed: '<img onerror=x>' } }),
    );
    runPrePaintScript();
    expect(document.documentElement.dataset.sidebar).toBe('expanded');
  });
});
