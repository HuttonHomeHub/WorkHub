# scripts/

Repository automation and developer-convenience scripts. Keep scripts:

- **POSIX-friendly** (`#!/usr/bin/env bash`, `set -euo pipefail`) or plain
  dependency-free Node (`.mjs`),
- **idempotent** — safe to run more than once,
- **documented** — a header comment explaining purpose and usage.

| Script               | Run it with                               | Purpose                                                                                                           |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `setup.sh`           | `./scripts/setup.sh`                      | Bootstrap local development (deps, `.env`, Postgres, shared-package build, migrations). Run by the dev container. |
| `gen-feature.mjs`    | `pnpm gen:feature <entity> --tool <tool>` | Generate a backend feature from the reference template (ADR-0015, `docs/REFERENCE_FEATURE.md`).                   |
| `verify-template.sh` | `bash scripts/verify-template.sh [--e2e]` | Generate a throwaway feature and type-check, lint, unit-test (and optionally API-test) it; restores files.        |
| `check-docs.mjs`     | `pnpm docs:check`                         | Fail on broken relative links and stale terms in Markdown (single-source docs guard).                             |

Prefer adding cross-cutting commands as `package.json` scripts (run via
Turborepo) so they are discoverable and cached; reserve this directory for
glue that doesn't fit the Node task runner.
