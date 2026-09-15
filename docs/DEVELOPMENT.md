# Development guide

How to set up a local environment and work day-to-day.

## Prerequisites

| Tool    | Version    | Notes                                               |
| ------- | ---------- | --------------------------------------------------- |
| Node.js | ≥ 24 (LTS) | Use the version in [`.nvmrc`](../.nvmrc); `nvm use` |
| pnpm    | ≥ 10       | `corepack enable` provides the pinned version       |
| Docker  | recent     | For local PostgreSQL / full-stack compose           |
| Git     | recent     | —                                                   |

## Codespaces / dev container (zero setup)

Open the repo in GitHub Codespaces or VS Code's "Reopen in Container". The
[`.devcontainer/`](../.devcontainer/devcontainer.json) pins Node 24, provides
Docker, and runs `./scripts/setup.sh` on creation — so dependencies, `.env`,
Postgres, and migrations are ready when the editor opens. Then `pnpm dev`.
Recommended editor extensions come from [`.vscode/extensions.json`](../.vscode/extensions.json).

## First-time setup

```bash
corepack enable            # enable pnpm at the version pinned in package.json
./scripts/setup.sh         # deps + .env + local Postgres (idempotent)
```

`setup.sh` copies [`.env.example`](../.env.example) to `.env`. Review it and set
real secrets before connecting to real services. **Never commit `.env`.**

## Running

```bash
pnpm dev            # run web + api in watch mode (Turborepo orchestrates)
```

- Web dev server: <http://localhost:5173> (proxies `/api` to the API). Sign in
  as **dev@example.com** / **dev-password-123** (see [Accounts](#accounts-no-email)).
- API: <http://localhost:3000>.
- **Sign-in only works from trusted addresses.** Better Auth rejects sign-in
  from any origin not in `CORS_ORIGINS`. The default covers
  `http://localhost:5173` and `https://localhost:5173` (VS Code port forwarding
  may use https). In Codespaces opened in the browser, also add the forwarded
  address (`https://<codespace>-5173.app.github.dev`) to `.env` and restart
  `pnpm dev`. If sign-in says _"We couldn't sign you in right now"_, check the API
  log for `Invalid origin: …`.

Run a single app:

```bash
pnpm --filter @repo/web dev
pnpm --filter @repo/api dev
```

Full stack in containers:

```bash
docker compose up -d       # db + api + web
docker compose logs -f api
docker compose down        # add -v to also drop the database volume
```

## Accounts (no email)

Public sign-up is off by default and nothing sends email (ADR-0018):

```bash
pnpm db:seed                                           # (re)create dev@example.com / dev-password-123; refuses in production
pnpm user:create --email you@example.com --name "You"  # prompts for the password
pnpm user:reset-password --email you@example.com       # new password; signs out existing sessions
```

`setup.sh` runs `pnpm db:seed` for you. Set `AUTH_SIGNUP_ENABLED=true` in `.env`
to try the public sign-up page locally.

## Database & Prisma

```bash
pnpm --filter @repo/api prisma:migrate    # create/apply a dev migration
pnpm --filter @repo/api prisma:generate   # regenerate the client
pnpm --filter @repo/api prisma:studio     # browse data
```

Migrations are committed. Any schema change is reviewed and, where feasible,
backward-compatible (expand/contract).

## Building a feature

```bash
pnpm gen:feature time-entry   # backend module + tests + model from the template
pnpm --filter @repo/api prisma:migrate --name add_time_entries
pnpm contract:generate        # regenerate apps/api/openapi.json + client types
```

See [`REFERENCE_FEATURE.md`](REFERENCE_FEATURE.md). After any endpoint change,
run `pnpm contract:generate` and commit the result — CI fails on drift
(ADR-0017).

## Everyday commands

| Command                             | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `pnpm lint` / `pnpm lint:fix`       | Lint (and auto-fix) the workspace        |
| `pnpm format` / `pnpm format:check` | Format / check formatting                |
| `pnpm typecheck`                    | Type-check all packages                  |
| `pnpm test` / `pnpm test:e2e`       | Run tests                                |
| `pnpm build`                        | Build everything                         |
| `pnpm commit`                       | Guided Conventional Commit               |
| `pnpm changeset`                    | Record a user-visible change for release |
| `pnpm gen:feature <entity>`         | Generate a backend feature (template)    |
| `pnpm contract:generate`            | Regenerate the API contract + types      |
| `pnpm docs:check`                   | Check docs for broken links/stale terms  |
| `pnpm clean`                        | Remove build output and caches           |

## Monorepo notes

- **Turborepo** runs tasks across packages with caching; task graph is in
  [`turbo.json`](../turbo.json).
- **pnpm workspaces** link local packages; reference them as `@repo/*` and pin
  shared dependency versions via the catalog in
  [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).
- Add a dependency to a specific package:
  `pnpm --filter @repo/web add <pkg>`.

## Git hooks

Husky installs hooks on `pnpm install`:

- **pre-commit:** `lint-staged` formats staged files with Prettier. (Linting
  and type-checking are enforced by `turbo` in CI to keep commits fast and
  reliable across the monorepo; run `pnpm lint` yourself before pushing.)
- **commit-msg:** commitlint enforces Conventional Commits.

## Editor

VS Code users get recommended extensions and workspace settings from
[`.vscode/`](../.vscode). Formatting on save and ESLint flat-config are
pre-wired. Any editor that respects [`.editorconfig`](../.editorconfig) works.

## Troubleshooting

- **`pnpm` not found:** run `corepack enable`.
- **Type errors after pulling:** `pnpm install` then
  `pnpm --filter @repo/api prisma:generate`.
- **Port already in use:** stop the process on 5173/3000/5432 or adjust ports
  in `.env` / compose.
- **Stale build issues:** `pnpm clean && pnpm install`.
- **`Cannot find module '@repo/types/dist/…'`** when running an API script
  directly: build the shared package first, `pnpm --filter @repo/types build`
  (Turborepo tasks do this automatically).
