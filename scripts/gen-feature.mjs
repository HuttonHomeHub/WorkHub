#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generate a backend feature from the canonical reference template
// (apps/api/examples/reference-feature/, ADR-0015; docs/REFERENCE_FEATURE.md).
//
//   pnpm gen:feature <entity> --tool <tool> [--plural <plural>]
//   pnpm gen:feature <entity> --core [--plural <plural>]
//
// <entity> is the singular, kebab-case name of the resource (e.g. `work-day`).
// Every feature belongs to a tool or to the shared core (ADR-0020), so one of
// --tool or --core is required. It writes the module under
// modules/<tool>/<plural>/ (controller → service → repository, DTOs, unit
// tests), the API e2e test, the Prisma model + User back-relation under the
// tool's banner, and adds the module to the <Tool>Module group — creating the
// group and registering it in AppModule on first use — every rename done
// consistently. It never touches the database: create the migration yourself
// afterwards (printed next steps).
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
const USAGE =
  'usage: pnpm gen:feature <entity> (--tool <tool> | --core) [--plural <plural>] — singular kebab-case, e.g. work-day --tool hours';
let entity;
let pluralArg;
let toolArg;
let core = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--plural') pluralArg = args[++i];
  else if (args[i] === '--tool') toolArg = args[++i];
  else if (args[i] === '--core') core = true;
  else if (!entity) entity = args[i];
  else fail(`unexpected argument "${args[i]}"`);
}
if (!entity || !KEBAB.test(entity)) fail(USAGE);
if (/reference/.test(entity))
  fail('choose a name that does not contain "reference" (the template name)');
if (core === (toolArg !== undefined)) {
  fail(`pass exactly one of --tool <tool> or --core (ADR-0020)\n${USAGE}`);
}
if (toolArg !== undefined) {
  if (!KEBAB.test(toolArg)) fail(`--tool must be a kebab-case tool id, got "${toolArg ?? ''}"`);
  if (toolArg === 'core') fail('"core" is reserved — use --core for shared records');
  if (/reference/.test(toolArg)) fail('choose a tool id that does not contain "reference"');
}
// The module group: a tool id, or `core`.
const group = core ? 'core' : toolArg;

function pluralize(word) {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
const parts = entity.split('-');
const plural = pluralArg ?? [...parts.slice(0, -1), pluralize(parts.at(-1))].join('-');
if (!KEBAB.test(plural)) fail(`--plural must be kebab-case, got "${plural}"`);
if (plural === group) fail(`the entity plural "${plural}" must differ from its group's id`);

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
// The group: `HoursModule` in modules/hours/hours.module.ts, OpenAPI tag `Hours`.
const g = {
  kebab: group,
  GroupModule: `${pascal(group)}Module`,
  tag: sentence(group),
  banner: core ? '// === Core ===' : `// === Tool: ${group} ===`,
};

// "a" or "an" before the entity's words ("an excess conversion").
const article = /^[aeiou]/.test(n.words) ? 'an' : 'a';

// Template token → generated name. Order matters: longer tokens first.
const replacements = [
  [
    /\b([Aa]) reference item\b/g,
    (_, a) => `${a === 'A' ? 'A' : 'a'}${article.slice(1)} ${n.words}`,
  ],
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
  [/@ApiTags\('reference'\)/g, `@ApiTags('${g.tag}')`],
  [/\bReference items\b/g, n.SentencePlural],
  [/\breference items\b/g, n.wordsPlural],
  [/\bReference item\b/g, n.Sentence],
  [/\breference item\b/g, n.words],
];

// Allowed leftovers: Prisma's `references: [...]` and links to the template docs.
const LEFTOVER = /reference(?!s: \[|_feature\.md|-feature)/i;

function render(text, source, { nested = false } = {}) {
  let out = text;
  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  // The template sits at modules/<feature>/; a generated module sits one level
  // deeper, at modules/<group>/<plural>/, so shared imports need one more `../`.
  if (nested) out = out.replace(/from '((?:\.\.\/)+)(common|prisma)\//g, "from '../$1$2/");
  const leftover = LEFTOVER.exec(out);
  if (leftover) {
    const context = out.slice(Math.max(0, leftover.index - 40), leftover.index + 40);
    fail(`unrenamed template token in ${source}: "…${context}…" — update scripts/gen-feature.mjs`);
  }
  return out;
}

// --- Plan & preflight checks -------------------------------------------------
const groupDir = join(api, 'src/modules', g.kebab);
const moduleDest = join(groupDir, n.kebabPlural);
const groupModulePath = join(groupDir, `${g.kebab}.module.ts`);
const e2eDest = join(api, 'test', `${n.kebabPlural}.e2e-spec.ts`);
const schemaPath = join(api, 'prisma/schema.prisma');
const appModulePath = join(api, 'src/app.module.ts');
const groupExists = existsSync(groupModulePath);

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
let groupModule = groupExists ? readFileSync(groupModulePath, 'utf8') : null;
const groupArrays = core ? ['imports', 'exports'] : ['imports'];
if (groupModule) {
  for (const key of groupArrays) {
    if (!new RegExp(`${key}: \\[`).test(groupModule)) {
      fail(`could not find the @Module ${key} in ${relative(root, groupModulePath)}`);
    }
  }
}

// --- Render everything before writing anything --------------------------------
const files = new Map();
function collect(srcDir, destDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === 'README.md') continue;
    const src = join(srcDir, entry.name);
    const dest = join(destDir, render(entry.name, relative(root, src)));
    if (entry.isDirectory()) collect(src, dest);
    else files.set(dest, render(readFileSync(src, 'utf8'), relative(root, src), { nested: true }));
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
// Models sit under their group's banner (ADR-0020 §1): appended to the end of
// the group's section, or a new section — core before the first tool.
const modelBlock = `// ${n.SentencePlural} (generated from the reference template, docs/REFERENCE_FEATURE.md).\n${model.trimEnd()}\n`;
const BANNER = /^\/\/ === (?:Tool: [a-z0-9-]+|Core) ===$/gm;
const banners = [...schema.matchAll(BANNER)].map((m) => ({ text: m[0], index: m.index }));
const own = banners.findIndex((b) => b.text === g.banner);
if (own !== -1) {
  const end = banners[own + 1]?.index ?? schema.length;
  schema = `${schema.slice(0, end).trimEnd()}\n\n${modelBlock}\n${schema.slice(end)}`;
} else {
  const firstTool = banners.find((b) => b.text.startsWith('// === Tool:'));
  const at = core && firstTool ? firstTool.index : schema.length;
  schema = `${schema.slice(0, at).trimEnd()}\n\n${g.banner}\n\n${modelBlock}\n${schema.slice(at)}`;
}
schema = `${schema.trimEnd()}\n`;

// Sort a block of `import … from '…';` lines by path.
const pathOf = (line) => line.slice(line.indexOf("from '"));
const addImport = (source, line) => {
  const [block] = source.match(localImports);
  const sorted = [...block.trimEnd().split('\n'), line].sort((a, b) =>
    pathOf(a).localeCompare(pathOf(b)),
  );
  return source.replace(block, `${sorted.join('\n')}\n`);
};

// The group module: created on first use (and registered in AppModule), else
// the entity module is added to it. Core also exports its entity modules, so a
// tool that imports CoreModule can use the services they export.
const entityModule = `${n.PascalPlural}Module`;
const entityImport = `import { ${entityModule} } from './${n.kebabPlural}/${n.kebabPlural}.module';`;
if (groupModule) {
  groupModule = addImport(groupModule, entityImport);
  for (const key of groupArrays) {
    groupModule = groupModule.replace(
      new RegExp(`${key}: \\[([^\\]]*)\\]`),
      (_, list) =>
        `${key}: [${[
          ...list
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
          entityModule,
        ].join(', ')}]`,
    );
  }
} else {
  const doc = core
    ? ` * Shared core records (ADR-0020 §2): facts about the owner's work that more
 * than one tool needs. It exports each entity module, so a tool that imports
 * CoreModule can inject the services those modules export. Core never imports
 * a tool.`
    : ` * The ${g.kebab} tool's API (ADR-0020 §1): one module per entity, grouped here
 * and registered once in AppModule. A tool may import CoreModule for shared
 * records, never another tool's modules.`;
  groupModule = `import { Module } from '@nestjs/common';

${entityImport}

/**
${doc}
 */
@Module({
${groupArrays.map((key) => `  ${key}: [${entityModule}],`).join('\n')}
})
export class ${g.GroupModule} {}
`;
  appModule = addImport(
    appModule,
    `import { ${g.GroupModule} } from './modules/${g.kebab}/${g.kebab}.module';`,
  ).replace(moduleImports, `$1\n    ${g.GroupModule},$2`);
}
files.set(groupModulePath, groupModule);

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
run('pnpm', ['exec', 'prisma', 'generate'], api);
// Renaming can reorder imports alphabetically (`./dto/work-day-response.dto`
// sorts after `./dto/update-work-day.dto`), so let ESLint fix their order —
// after `prisma generate`, because type-aware lint needs the new model's
// client. Any other lint error is left for the caller's lint run to report.
try {
  run('pnpm', ['exec', 'eslint', '--fix', ...files.keys(), appModulePath], api);
} catch {
  console.warn('gen:feature: eslint --fix left lint errors — run pnpm lint to see them');
}

const rel = (path) => relative(root, path);
console.log(`✔ Generated the ${n.wordsPlural} feature from the reference template:
  - ${rel(moduleDest)}/  (controller, service, repository, DTOs, unit tests)
  - ${rel(e2eDest)}
  - model ${n.Pascal} + User.${n.camelPlural} in ${rel(schemaPath)}, under "${g.banner}"
  - ${entityModule} added to ${g.GroupModule} (${rel(groupModulePath)})${
    groupExists ? '' : `, which is new and registered in ${rel(appModulePath)}`
  }

Next steps (docs/REFERENCE_FEATURE.md → Creating a new feature):
  1. Replace the placeholder fields (name/description/status) with your entity's
     fields in the model, DTOs, service, and tests.
  2. pnpm --filter @repo/api prisma:migrate --name add_${n.snakePlural}
  3. pnpm contract:generate   (commit apps/api/openapi.json + generated types)
  4. Make the unit + e2e tests green, update docs/API.md, add a changeset.`);
