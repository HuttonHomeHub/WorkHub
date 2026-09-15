#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Docs guard (CLAUDE.md §9 — state each rule once). Fails on:
//   1. relative Markdown links whose target file or directory does not exist;
//   2. known-stale terms that signal drift from the current architecture;
//   3. Claude Code agents/skills whose frontmatter `name` doesn't match the file.
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
  // Claude Code's git worktrees (.claude/worktrees/) are other checkouts.
  'worktrees',
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
  [/Blank App/, 'the product is WorkHub, not a generic starter (ADR-0019)'],
  [
    /multiple individual users|every account is its own tenant/i,
    'WorkHub has a single owner (ADR-0019, PRODUCT.md)',
  ],
  [/Using this as your base/i, 'WorkHub is one product, not a starter to fork (ADR-0019)'],
  // Agents consolidated from 12 to 8 (DECISIONS.md 2026-09-15). The lookbehind
  // keeps `performance-reviewer` from matching inside `backend-performance-reviewer`.
  [
    /\b(feature-analyst|ui-architect|ux-reviewer|component-reviewer|api-reviewer|backend-performance-reviewer)\b|(?<![\w-])performance-reviewer\b/,
    'agent removed — use planner, ui-reviewer or backend-reviewer (.claude/agents/README.md)',
  ],
  [
    /\b(Product Owner|Solution Architect|Definition of Ready)\b|Epic\s*(→|->)\s*Milestone/,
    'the team process was replaced by change classes (docs/PROCESS.md)',
  ],
  [
    /approving review|CODEOWNERS/i,
    'there are no human reviewers; the owner merges (docs/PROCESS.md)',
  ],
  [/docs\/(specs|plans)\//, 'feature docs live in docs/features/ (docs/PROCESS.md)'],
  [
    /ROADMAP\.md|feature-spec\.md|implementation-plan\.md|project-brief\.md|example-manage-items|CONTRIBUTING\.md|ISSUE_TEMPLATE/,
    'file removed — see PRODUCT.md (Roadmap), docs/templates/feature.md, docs/DEVELOPMENT.md',
  ],
  [/PROACTIVELY/, 'agents are triggered by /review, not by "PROACTIVELY" descriptions'],
];

// Agents and skills must be discoverable under the name their file implies.
function frontmatter(file) {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'));
  if (!match) return null;
  const fields = {};
  let key = null;
  for (const line of match[1].split('\n')) {
    const field = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (field) {
      key = field[1];
      fields[key] = field[2].replace(/^>-?\s*$/, '').trim();
    } else if (key && /^\s+\S/.test(line)) {
      fields[key] = `${fields[key]} ${line.trim()}`.trim();
    }
  }
  return fields;
}

function checkClaudeFile(file, expectedName) {
  const rel = relative(root, file);
  const fields = frontmatter(file);
  if (!fields) return problems.push(`${rel}  missing YAML frontmatter`);
  if (fields.name !== expectedName) {
    problems.push(`${rel}  frontmatter name "${fields.name ?? ''}" should be "${expectedName}"`);
  }
  if (!fields.description) problems.push(`${rel}  frontmatter description is empty`);
}

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

const agentsDir = join(root, '.claude', 'agents');
if (existsSync(agentsDir)) {
  for (const entry of readdirSync(agentsDir)) {
    if (entry.endsWith('.md') && entry !== 'README.md') {
      checkClaudeFile(join(agentsDir, entry), entry.slice(0, -'.md'.length));
    }
  }
}

const skillsDir = join(root, '.claude', 'skills');
if (existsSync(skillsDir)) {
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skill = join(skillsDir, entry.name, 'SKILL.md');
    if (existsSync(skill)) checkClaudeFile(skill, entry.name);
    else problems.push(`${relative(root, join(skillsDir, entry.name))}  missing SKILL.md`);
  }
}

if (problems.length > 0) {
  console.error(`docs:check found ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('docs:check ✔ no broken relative links, stale terms, or agent/skill name mismatches');
