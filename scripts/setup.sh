#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-shot local development bootstrap for WorkHub.
# Idempotent: safe to run repeatedly.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m warn:\033[0m %s\n' "$1"; }

# 1. Node version check ------------------------------------------------------
required_major=24
if command -v node >/dev/null 2>&1; then
  current_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$current_major" -lt "$required_major" ]; then
    warn "Node $current_major detected; WorkHub requires >= $required_major (see .nvmrc)."
  fi
else
  warn "Node.js not found. Install Node >= $required_major (see .nvmrc)."
fi

# 2. pnpm via corepack -------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  info "Enabling pnpm via corepack"
  corepack enable
fi

# 3. Environment file --------------------------------------------------------
if [ ! -f .env ]; then
  info "Creating .env from .env.example"
  cp .env.example .env
  warn "Edit .env and set real secrets before running against real services."
fi

# 4. Dependencies ------------------------------------------------------------
info "Installing dependencies"
pnpm install --frozen-lockfile

# 5. Local infrastructure ----------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  info "Starting local PostgreSQL (docker compose)"
  docker compose up -d db
else
  warn "Docker not found; start PostgreSQL yourself or install Docker."
fi

# 6. Database schema ----------------------------------------------------------
info "Building shared packages (@repo/types, ADR-0017)"
pnpm --filter @repo/types build

info "Generating the Prisma client and applying migrations"
pnpm --filter @repo/api prisma:generate
if pnpm --filter @repo/api prisma:deploy; then
  # 7. Development account (ADR-0018) ------------------------------------------
  info "Seeding the development account"
  pnpm db:seed || warn "Could not seed the dev account — run 'pnpm db:seed' later."
else
  warn "Could not apply migrations — is PostgreSQL up and DATABASE_URL correct?"
fi

info "Setup complete. Run 'pnpm dev', then sign in as dev@example.com / dev-password-123."
