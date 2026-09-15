#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generate a backend feature from the canonical reference template
// (apps/api/examples/reference-feature/, ADR-0015; docs/REFERENCE_FEATURE.md).
//
//   pnpm gen:feature <entity> [--plural <plural>]
//
// <entity> is the singular, kebab-case name of the resource (e.g. `time-entry`).
// It writes the module (controller → service → repository, DTOs, unit tests),
// the API e2e test, the Prisma model + User back-relation, and registers the
// module in AppModule — every rename done consistently. It never touches the
// database: create the migration yourself afterwards (printed next steps).
//
// If the template gains a token this script doesn't rename, generation fails
// loudly instead of emitting half-renamed code (CI runs it via
// scripts/verify-template.sh).
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = join(root, 'apps/api');
const template = join(api, 'examples/reference-feature');
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function fail(message) {
  console.error(`gen:feature: ${message}`);
  process.exit(1);
}

// --- Arguments ---------------------------------------------------------------
let entity;
let pluralArg;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--plural') pluralArg = args[++i];
  else if (!entity) entity = args[i];
  else fail(`unexpected argument "${args[i]}"`);
}
if (!entity || !KEBAB.test(entity)) {
  fail(
    'usage: pnpm gen:feature <entity> [--plural <plural>] — singular kebab-case, e.g. time-entry',
  );
}
if (/reference/.test(entity))
  fail('choose a name that does not contain "reference" (the template name)');

function pluralize(word) {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
const parts = entity.split('-');
const plural = pluralArg ?? [...parts.slice(0, -1), pluralize(parts.at(-1))].join('-');
if (!KEBAB.test(plural)) fail(`--plural must be kebab-case, got "${plural}"`);

// --- Name forms --------------------------------------------------------------
const pascal = (kebab) =>
  kebab
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
const camel = (kebab) => pascal(kebab)[0].toLowerCase() + pascal(kebab).slice(1);
const words = (kebab) => kebab.replaceAll('-', ' ');
const sentence = (kebab) => words(kebab)[0].toUpperCase() + words(kebab).slice(1);

const n = {
  kebab: entity,
  kebabPlural: plural,
  Pascal: pascal(entity),
  PascalPlural: pascal(plural),
  camel: camel(entity),
  camelPlural: camel(plural),
  snakePlural: plural.replaceAll('-', '_'),
  words: words(entity),
  wordsPlural: words(plural),
  Sentence: sentence(entity),
  SentencePlural: sentence(plural),
};

// Template token → generated name. Order matters: longer tokens first.
const replacements = [
  [/ReferenceItemStatus/g, `${n.Pascal}Status`],
  [/ReferenceItems/g, n.PascalPlural],
  [/ReferenceItem/g, n.Pascal],
  [/Reference(Controller|Service|Repository|Module)\b/g, `${n.PascalPlural}$1`],
  [/referenceItems/g, n.camelPlural],
  [/referenceItem/g, n.camel],
  [/\breference-items\b/g, n.kebabPlural],
  [/\breference-item\b/g, n.kebab],
  [/\breference_items\b/g, n.snakePlural],
  [/\breference\.(controller|service|repository|module|e2e-spec)\b/g, `${n.kebabPlural}.$1`],
  [/'reference'/g, `'${n.kebabPlural}'`],
  [/\bReference items\b/g, n.SentencePlural],
  [/\breference items\b/g, n.wordsPlural],
  [/\bReference item\b/g, n.Sentence],
  [/\breference item\b/g, n.words],
];

// Allowed leftovers: Prisma's `references: [...]` and links to the template docs.
const LEFTOVER = /reference(?!s: \[|_feature\.md|-feature)/i;

function render(text, source) {
  let out = text;
  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  const leftover = LEFTOVER.exec(out);
  if (leftover) {
    const context = out.slice(Math.max(0, leftover.index - 40), leftover.index + 40);
    fail(`unrenamed template token in ${source}: "…${context}…" — update scripts/gen-feature.mjs`);
  }
  return out;
}

// --- Plan & preflight checks -------------------------------------------------
const moduleDest = join(api, 'src/modules', n.kebabPlural);
const e2eDest = join(api, 'test', `${n.kebabPlural}.e2e-spec.ts`);
const schemaPath = join(api, 'prisma/schema.prisma');
const appModulePath = join(api, 'src/app.module.ts');

for (const dest of [moduleDest, e2eDest]) {
  if (existsSync(dest)) fail(`${relative(root, dest)} already exists`);
}
let schema = readFileSync(schemaPath, 'utf8');
// Compare parsed names rather than building regexes from the CLI argument.
const declaredTypes = new Set(
  schema
    .split('\n')
    .map((line) => /^(?:model|enum) (\w+) /.exec(line)?.[1])
    .filter(Boolean),
);
if (declaredTypes.has(n.Pascal) || declaredTypes.has(`${n.Pascal}Status`)) {
  fail(`schema.prisma already defines ${n.Pascal} or ${n.Pascal}Status`);
}
const userModel = /(model User \{[\s\S]*?)(\n\n\s*@@map\("users"\))/;
if (!userModel.test(schema)) fail('could not find the User model in schema.prisma');
const userFields = schema
  .match(userModel)[1]
  .split('\n')
  .slice(1)
  .map((line) => line.trim().split(/\s+/)[0]);
if (userFields.includes(n.camelPlural)) {
  fail(`the User model already has a "${n.camelPlural}" field`);
}
let appModule = readFileSync(appModulePath, 'utf8');
const localImports = /(?:^import .* from '\.\/.*';\n)+/m;
const moduleImports = /(imports: \[[\s\S]*?)(\n {2}\],)/;
if (!localImports.test(appModule) || !moduleImports.test(appModule)) {
  fail('could not find the local imports / @Module imports in app.module.ts');
}

// --- Render everything before writing anything --------------------------------
const files = new Map();
function collect(srcDir, destDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === 'README.md') continue;
    const src = join(srcDir, entry.name);
    const dest = join(destDir, render(entry.name, relative(root, src)));
    if (entry.isDirectory()) collect(src, dest);
    else files.set(dest, render(readFileSync(src, 'utf8'), relative(root, src)));
  }
}
collect(join(template, 'module'), moduleDest);
const e2eSource = join(template, 'reference.e2e-spec.ts');
files.set(e2eDest, render(readFileSync(e2eSource, 'utf8'), relative(root, e2eSource)));

const sketchPath = join(template, 'schema.reference.prisma');
const sketch = readFileSync(sketchPath, 'utf8');
const model = render(sketch.slice(sketch.search(/^(enum|model) /m)), relative(root, sketchPath));
schema = schema
  // The "no domain models yet" note is stale once the first feature lands.
  .replace(/\n\/\/ -+\n\/\/ No domain models yet[\s\S]*?\/\/ -+\n/, '\n')
  .replace(userModel, `$1\n  ${n.camelPlural} ${n.Pascal}[]$2`);
schema = `${schema.trimEnd()}\n\n// ${n.SentencePlural} (generated from the reference template, docs/REFERENCE_FEATURE.md).\n${model}`;

const importLine = `import { ${n.PascalPlural}Module } from './modules/${n.kebabPlural}/${n.kebabPlural}.module';`;
const [importBlock] = appModule.match(localImports);
const pathOf = (line) => line.slice(line.indexOf("from '"));
const sortedImports = [...importBlock.trimEnd().split('\n'), importLine].sort((a, b) =>
  pathOf(a).localeCompare(pathOf(b)),
);
appModule = appModule
  .replace(importBlock, `${sortedImports.join('\n')}\n`)
  .replace(moduleImports, `$1\n    ${n.PascalPlural}Module,$2`);

// --- Write -------------------------------------------------------------------
for (const [dest, content] of files) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
}
writeFileSync(schemaPath, schema);
writeFileSync(appModulePath, appModule);

const run = (command, commandArgs, cwd) =>
  execFileSync(command, commandArgs, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
run('pnpm', ['exec', 'prettier', '--write', ...files.keys(), appModulePath], root);
run('pnpm', ['exec', 'prisma', 'format'], api);

const rel = (path) => relative(root, path);
console.log(`✔ Generated the ${n.wordsPlural} feature from the reference template:
  - ${rel(moduleDest)}/  (controller, service, repository, DTOs, unit tests)
  - ${rel(e2eDest)}
  - model ${n.Pascal} + User.${n.camelPlural} in ${rel(schemaPath)}
  - ${n.PascalPlural}Module registered in ${rel(appModulePath)}

Next steps (docs/REFERENCE_FEATURE.md → Creating a new feature):
  1. Replace the placeholder fields (name/description/status) with your entity's
     fields in the model, DTOs, service, and tests.
  2. pnpm --filter @repo/api prisma:migrate --name add_${n.snakePlural}
  3. pnpm contract:generate   (commit apps/api/openapi.json + generated types)
  4. Make the unit + e2e tests green, update docs/API.md, add a changeset.`);
