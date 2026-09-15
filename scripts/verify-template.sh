#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Verify the reference-feature template AND the generator that copies it
# (docs/REFERENCE_FEATURE.md, ADR-0015) still work against the current codebase,
# so the canonical implementation standard can never silently rot.
#
# Generates a throwaway feature with a multi-word name (so rename mistakes in
# scripts/gen-feature.mjs surface), then type-checks, lints, and unit-tests it.
#
#   bash scripts/verify-template.sh          # no database needed
#   bash scripts/verify-template.sh --e2e    # also push the schema to DATABASE_URL
#                                            # and run the feature's API e2e test
#
# Every file the generator touches is backed up and restored on exit — git is
# never used, so uncommitted work is safe. Idempotent.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

E2E=false
if [ "${1:-}" = "--e2e" ]; then E2E=true; fi

API=apps/api
MODULE_DEST=$API/src/modules/sample-widgets
E2E_DEST=$API/test/sample-widgets.e2e-spec.ts
TOUCHED=("$API/prisma/schema.prisma" "$API/src/app.module.ts")

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

# Refuse BEFORE installing the cleanup trap, so real work is never deleted.
for path in "$MODULE_DEST" "$E2E_DEST"; do
  if [ -e "$path" ]; then
    echo "verify-template: $path already exists — remove it first." >&2
    exit 1
  fi
done

BACKUP=$(mktemp -d)
for file in "${TOUCHED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp "$file" "$BACKUP/$file"
done

cleanup() {
  info 'Restoring files touched by the generator'
  rm -rf "$MODULE_DEST" "$E2E_DEST"
  for file in "${TOUCHED[@]}"; do cp "$BACKUP/$file" "$file"; done
  rm -rf "$BACKUP"
  if $E2E; then
    # Drop the throwaway table so the database matches the migrations again.
    pnpm --filter @repo/api exec prisma db push --skip-generate --accept-data-loss >/dev/null 2>&1 || true
  fi
  # Restore the Prisma client for the real schema so local dev isn't left confused.
  pnpm --filter @repo/api exec prisma generate >/dev/null 2>&1 || true
}
trap cleanup EXIT

info 'Generating a sample feature from the template (pnpm gen:feature sample-widget)'
node scripts/gen-feature.mjs sample-widget

info 'Generating the Prisma client and building shared packages'
pnpm --filter @repo/api exec prisma generate >/dev/null
pnpm --filter @repo/types build >/dev/null

info 'Type-checking (generated module + e2e spec against the live codebase)'
pnpm --filter @repo/api exec tsc --noEmit

info 'Linting the generated code'
pnpm --filter @repo/api exec eslint src/modules/sample-widgets test/sample-widgets.e2e-spec.ts src/app.module.ts

info 'Running the generated unit tests'
pnpm --filter @repo/api exec vitest run src/modules/sample-widgets

if $E2E; then
  info 'Pushing the generated schema to DATABASE_URL and running the API e2e test'
  pnpm --filter @repo/api exec prisma db push --skip-generate --accept-data-loss >/dev/null
  pnpm --filter @repo/api exec vitest run --config vitest.e2e.config.ts test/sample-widgets.e2e-spec.ts
fi

info 'Template verified ✔ — the generator output compiles, lints, and passes its tests.'
