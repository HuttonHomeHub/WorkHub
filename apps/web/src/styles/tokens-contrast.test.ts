import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * WCAG contrast of every colour pair the design system uses, measured from
 * the tokens in globals.css in both themes (docs/ACCESSIBILITY.md → Colour
 * and contrast):
 *
 * - text (1.4.3): 4.5:1 for every foreground on every surface it appears on;
 * - non-text (1.4.11): 3:1 for control boundaries (`--input`), the focus ring,
 *   and state fills such as a switch's track.
 *
 * Colours are `oklch()` literals, converted to sRGB with the OKLab matrices
 * (Björn Ottosson) and clipped to the gamut as browsers do, then measured
 * with the WCAG relative-luminance formula.
 */
const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`no ${selector} block`);
  return css.slice(start, css.indexOf('\n}', start));
}

type Oklch = [lightness: number, chroma: number, hue: number];

function colour(themeBlock: string, token: string): Oklch {
  const match = new RegExp(`--${token}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`).exec(
    themeBlock,
  );
  if (!match) throw new Error(`--${token} is not an opaque oklch() colour`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** OKLCH → linear sRGB, clipped to [0, 1]. */
function linearSrgb([l, c, h]: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clip(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    clip(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    clip(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  ];
}

/**
 * WCAG relative luminance. Clipping happens in linear light; the sRGB
 * transfer function round-trips, so the linear values are used directly.
 */
function luminance(value: Oklch): number {
  const [r, g, b] = linearSrgb(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Oklch, b: Oklch): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Everything a row, a card or a panel can sit on. */
const SURFACES = [
  'background',
  'card',
  'popover',
  'muted',
  'table-stripe',
  'table-hover',
  'highlight',
];

const STATUSES = ['success', 'warning', 'info', 'destructive'] as const;

/** [foreground, background, minimum ratio] */
const PAIRS: [string, string, number][] = [
  // Body and meta text on every surface.
  ...SURFACES.flatMap((surface): [string, string, number][] => [
    ['foreground', surface, 4.5],
    ['muted-foreground', surface, 4.5],
    // Control boundaries (1.4.11).
    ['input', surface, 3],
  ]),
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['muted-foreground', 'accent', 4.5],
  // Solid fills and their foregrounds (buttons, the Today pill, badges).
  ['primary-foreground', 'primary', 4.5],
  ...STATUSES.map((status): [string, string, number] => [`${status}-foreground`, status, 4.5]),
  // Status text (flexi, notes, warnings, errors) on surfaces and its soft fill.
  ...STATUSES.flatMap((status): [string, string, number][] => [
    ...SURFACES.map((surface): [string, string, number] => [`${status}-text`, surface, 4.5]),
    [`${status}-text`, `${status}-soft`, 4.5],
    ['foreground', `${status}-soft`, 4.5],
  ]),
  // Links and the accent as text.
  ['primary', 'background', 4.5],
  ['primary', 'card', 4.5],
  // The focus ring and state fills (a switch's track, the progress bar).
  ...['background', 'card', 'popover', 'table-stripe', 'highlight', 'sidebar'].map(
    (surface): [string, string, number] => ['ring', surface, 3],
  ),
  ['primary', 'muted', 3],
  // The sidebar.
  ['sidebar-foreground', 'sidebar', 4.5],
  ['sidebar-foreground', 'sidebar-accent', 4.5],
  ['sidebar-accent-foreground', 'sidebar-accent', 4.5],
  ['muted-foreground', 'sidebar', 4.5],
  ['sidebar-primary', 'sidebar-accent', 3],
];

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('the %s theme', (_, selector) => {
  const theme = block(selector);
  it.each(PAIRS)('--%s on --%s reaches %s:1', (foreground, background, minimum) => {
    const ratio = contrast(colour(theme, foreground), colour(theme, background));
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
  });
});

describe('the conversion', () => {
  it('matches known sRGB values', () => {
    // White and black, and a mid grey of known luminance.
    expect(luminance([1, 0, 0])).toBeCloseTo(1, 3);
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(contrast([1, 0, 0], [0, 0, 0])).toBeCloseTo(21, 1);
    // oklch(0.6 0 0) is L³ = 0.216 in linear light.
    expect(luminance([0.6, 0, 0])).toBeCloseTo(0.216, 3);
  });
});
