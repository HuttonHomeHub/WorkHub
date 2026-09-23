import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * WCAG 1.4.11: a control's boundary needs 3:1 against what it sits on. The
 * `--input` token draws every Input, NativeSelect and outline Button border,
 * so it is measured here against the page, card and muted surfaces in both
 * themes. Achromatic OKLCH only: for `oklch(L 0 0)` relative luminance is L³.
 */
const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no ${selector} block`);
  return css.slice(start, css.indexOf('}', start));
}

function luminance(themeBlock: string, token: string): number {
  const match = new RegExp(`--${token}:\\s*oklch\\(([\\d.]+) 0 0\\)`).exec(themeBlock);
  if (!match) throw new Error(`--${token} is not an achromatic oklch() colour`);
  return Number(match[1]) ** 3;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('--input in the %s theme', (_, selector) => {
  const theme = block(selector);
  it.each(['background', 'card', 'muted'])('has at least 3:1 against --%s', (surface) => {
    expect(contrast(luminance(theme, 'input'), luminance(theme, surface))).toBeGreaterThanOrEqual(
      3,
    );
  });
});
