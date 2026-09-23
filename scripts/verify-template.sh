#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Verify the reference-feature template AND the generator that copies it
# (docs/REFERENCE_FEATURE.md, ADR-0015) still work against the current codebase,
# so the canonical implementation standard can never silently rot.
#
# Generates two throwaway features with multi-word names (so rename mistakes in
# scripts/gen-feature.mjs surface): one in a new tool (`--tool sample-kit`,
# which also creates the group module and registers it in AppModule) and one in
# the shared core (`--core`, ADR-0020). Then type-checks, lints, and unit-tests
# them.
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
TOOL_DIR=$API/src/modules/sample-kit
CORE_DIR=$API/src/modules/core
CORE_DEST=$CORE_DIR/sample-gadgets
CORE_MODULE=$CORE_DIR/core.module.ts
E2E_DESTS=("$API/test/sample-widgets.e2e-spec.ts" "$API/test/sample-gadgets.e2e-spec.ts")
TOUCHED=("$API/prisma/schema.prisma" "$API/src/app.module.ts")
# The core group may already exist with real modules: back it up and restore it.
CORE_EXISTED=false
if [ -e "$CORE_MODULE" ]; then
  CORE_EXISTED=true
  TOUCHED+=("$CORE_MODULE")
fi

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

# Refuse BEFORE installing the cleanup trap, so real work is never deleted.
for path in "$TOOL_DIR" "$CORE_DEST" "${E2E_DESTS[@]}"; do
  if [ -e "$path" ]; then
    echo "verify-template: $path already exists — remove it first." >&2
    exit 1
  fi
done

# --e2e pushes a throwaway schema with --accept-data-loss (and pushes the real
# one back afterwards), which can drop tables and data. Refuse BEFORE touching
# anything unless DATABASE_URL names a *_test database or this is CI's
# disposable database.
database_name() {
  local url="${1%%\?*}"
  printf '%s' "${url##*/}"
}

assert_disposable_database() {
  local name
  name=$(database_name "${DATABASE_URL:-}")
  if [ "${CI:-}" = "true" ] || [[ "$name" == *_test ]]; then
    return 0
  fi
  cat >&2 <<EOF
verify-template: refusing to run --e2e against database '${name:-<DATABASE_URL unset>}'.
  It pushes a throwaway schema with --accept-data-loss, which can destroy data.
  Point DATABASE_URL at a test database whose name ends in _test, e.g.:
    DATABASE_URL='postgresql://app:app@localhost:5432/app_test?schema=public' \\
      bash scripts/verify-template.sh --e2e
EOF
  exit 1
}

if $E2E; then assert_disposable_database; fi

BACKUP=$(mktemp -d)
for file in "${TOUCHED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp "$file" "$BACKUP/$file"
done

cleanup() {
  info 'Restoring files touched by the generator'
  rm -rf "$TOOL_DIR" "$CORE_DEST" "${E2E_DESTS[@]}"
  for file in "${TOUCHED[@]}"; do cp "$BACKUP/$file" "$file"; done
  if ! $CORE_EXISTED; then
    rm -f "$CORE_MODULE"
    rmdir "$CORE_DIR" 2>/dev/null || true
  fi
  rmdir "$API/src/modules" 2>/dev/null || true
  rm -rf "$BACKUP"
  if $E2E; then
    # Drop the throwaway table so the database matches the migrations again.
    pnpm --filter @repo/api exec prisma db push --skip-generate --accept-data-loss >/dev/null 2>&1 || true
  fi
  # Restore the Prisma client for the real schema so local dev isn't left confused.
  pnpm --filter @repo/api exec prisma generate >/dev/null 2>&1 || true
}
trap cleanup EXIT

info 'Generating sample features (gen:feature sample-widget --tool sample-kit; sample-gadget --core)'
node scripts/gen-feature.mjs sample-widget --tool sample-kit
node scripts/gen-feature.mjs sample-gadget --core

info 'Generating the Prisma client and building shared packages'
pnpm --filter @repo/api exec prisma generate >/dev/null
pnpm --filter @repo/types build >/dev/null

info 'Type-checking (generated modules + e2e specs against the live codebase)'
pnpm --filter @repo/api exec tsc --noEmit

info 'Linting the generated code'
pnpm --filter @repo/api exec eslint src/modules/sample-kit src/modules/core \
  test/sample-widgets.e2e-spec.ts test/sample-gadgets.e2e-spec.ts src/app.module.ts

info 'Running the generated unit tests'
pnpm --filter @repo/api exec vitest run src/modules/sample-kit src/modules/core/sample-gadgets

if $E2E; then
  info 'Pushing the generated schema to DATABASE_URL and running the API e2e tests'
  pnpm --filter @repo/api exec prisma db push --skip-generate --accept-data-loss >/dev/null
  pnpm --filter @repo/api exec vitest run --config vitest.e2e.config.ts \
    test/sample-widgets.e2e-spec.ts test/sample-gadgets.e2e-spec.ts
fi

info 'Template verified ✔ — the generator output (tool and core) compiles, lints, and passes its tests.'
