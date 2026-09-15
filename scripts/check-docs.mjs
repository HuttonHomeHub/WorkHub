#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Docs guard (CLAUDE.md §6 — state each rule once). Fails on:
//   1. relative Markdown links whose target file or directory does not exist;
//   2. known-stale terms that signal drift from the current architecture.
//
//   pnpm docs:check      (runs in the CI quality job)
//
// When a decision is superseded, add its tell-tale terms to STALE_TERMS so no
// document can quietly keep describing the old world.
// ---------------------------------------------------------------------------
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'playwright-report',
  'test-results',
]);

// Historical records legitimately describe superseded decisions.
const HISTORICAL = [/^docs\/adr\//, /^docs\/DECISIONS\.md$/, /^CHANGELOG\.md$/, /^\.changeset\//];

const STALE_TERMS = [
  [/\bADR-0012\b/, 'ADR-0012 is superseded — reference ADR-0016 (owner-based access)'],
  [/\bRBAC\b/, 'RBAC was replaced by owner-based access (ADR-0016)'],
  [
    /organi[sz]ation[- ]scop|organisation roles|permission \+ (resource )?scope/i,
    'organisation scoping/permissions were replaced by ownership (ADR-0016)',
  ],
  [/BILL_|useBills|BillCard/, 'leftover from the Bills product'],
  [
    /until Better Auth is\s+wired|when you add auth|seam currently returns null/i,
    'Better Auth is wired end-to-end',
  ],
  [/roadmap M1\)/, 'milestone M1 is done'],
  [
    /HuttonHomeHub\/blank-app|huttonhomehub\/blank-app/,
    'repository placeholders point at HuttonHomeHub/WorkHub',
  ],
  [
    /open (email\/password )?(self-?)?sign-?up|sign up and you're in/i,
    'public sign-up is off by default (ADR-0018)',
  ],
  [
    /hosting platform (is )?(an open decision|undecided)|deliberately undecided/i,
    'hosting is decided: self-hosted Compose (DEPLOYMENT.md)',
  ],
  [
    /\bvX\.Y\.Z\b|IMAGE_TAG=v\d/,
    'releases are tagged @repo/<app>@X.Y.Z and images X.Y.Z, without a v (DEPLOYMENT.md)',
  ],
];

function markdownFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...markdownFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith('.md')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
const problems = [];

for (const file of markdownFiles(root)) {
  const rel = relative(root, file);
  const historical = HISTORICAL.some((pattern) => pattern.test(rel));
  let inFence = false;

  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const where = `${rel}:${index + 1}`;
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return;

      for (const [, target] of line.matchAll(LINK)) {
        if (/^(https?:|mailto:|#|<)/.test(target)) continue;
        const path = decodeURIComponent(target.split('#')[0].split('?')[0]);
        if (path && !existsSync(resolve(dirname(file), path))) {
          problems.push(`${where}  broken link → ${target}`);
        }
      }

      // A line that says a decision was superseded may name the old decision.
      if (historical || /supersed/i.test(line)) return;
      for (const [pattern, reason] of STALE_TERMS) {
        if (pattern.test(line)) problems.push(`${where}  stale: ${reason}`);
      }
    });
}

if (problems.length > 0) {
  console.error(`docs:check found ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('docs:check ✔ no broken relative links or stale terms');
