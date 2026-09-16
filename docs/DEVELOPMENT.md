# Development guide

How to set up a local environment and work day-to-day.

## Prerequisites

| Tool    | Version    | Notes                                               |
| ------- | ---------- | --------------------------------------------------- |
| Node.js | ≥ 24 (LTS) | Use the version in [`.nvmrc`](../.nvmrc); `nvm use` |
| pnpm    | ≥ 10       | `corepack enable` provides the pinned version       |
| Docker  | recent     | For local PostgreSQL (and full-stack compose)       |
| Git     | recent     | —                                                   |

## Codespaces / dev container (zero setup)

Open the repo in GitHub Codespaces or VS Code's "Reopen in Container". The
[`.devcontainer/`](../.devcontainer/devcontainer.json) pins Node 24, provides
Docker, and runs `./scripts/setup.sh` on creation — so dependencies, `.env`,
Postgres, migrations and the dev account are ready when the editor opens. Then
`pnpm dev`. Recommended editor extensions come from
[`.vscode/extensions.json`](../.vscode/extensions.json). Codespaces behave
differently from a local machine in a few ways — see
[Codespace specifics](#codespace-specifics).

## First-time setup

```bash
corepack enable            # enable pnpm at the version pinned in package.json
./scripts/setup.sh         # deps + .env + local Postgres (idempotent)
```

`setup.sh` copies [`.env.example`](../.env.example) to `.env`, starts the
`db` container, applies migrations and seeds the dev account. **Never commit
`.env`.** The API and the account commands load the root `.env` themselves
(variables already set in the environment win), so no `export` is needed before
`pnpm dev`.

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
  may use https); a browser Codespace needs its forwarded address too
  ([Codespace specifics](#codespace-specifics)). If sign-in says _"We couldn't
  sign you in right now"_, check the API log for `Invalid origin: …`.

Run a single app:

```bash
pnpm --filter @repo/web dev
pnpm --filter @repo/api dev
```

### Full stack in containers (local Docker only)

Builds the `api` and `web` images from the working tree and serves everything
through nginx at <http://localhost:8080>, as in production. **This does not work
in a Codespace** — see [Codespace specifics](#codespace-specifics).

```bash
docker compose up -d       # db + migrate + api + web
docker compose logs -f api
docker compose down        # keeps the database volume
```

The compose project is `workhub`; the local database lives in the volume
`workhub-dev-db-data` (container `workhub-db-1`). The server deployment is a
different file and procedure: [OPERATIONS.md](OPERATIONS.md).

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

Migrations are committed and forward-only; the workflow and the safety rules
for destructive changes are in [DATABASE.md](DATABASE.md#migrations).

### Reset the dev database

```bash
pnpm --filter @repo/api exec prisma migrate reset --force   # drop, recreate, re-apply migrations
pnpm db:seed                                                # recreate the dev account
```

To start from an empty volume instead, `docker compose down -v` (this also
removes the `app_test` database), then `./scripts/setup.sh`.

### Migrating the old dev database container

Before the rename to WorkHub, the dev database ran as the container
`blank-app-db-1` with the volume `blank-app_db-data`. A Codespace or machine
created before then may still have it, and it holds port 5432, so the new
`workhub-db-1` cannot start. Replace it:

```bash
docker rm -f blank-app-db-1    # the old volume is kept
./scripts/setup.sh             # starts workhub-db-1, applies migrations, re-seeds dev@example.com
```

Recreate `app_test` if you run API e2e ([Codespace specifics](#codespace-specifics)).
Once nothing in the old database is needed, remove its volume:
`docker volume rm blank-app_db-data`.

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

| Command                             | Description                             |
| ----------------------------------- | --------------------------------------- |
| `pnpm lint` / `pnpm lint:fix`       | Lint (and auto-fix) the workspace       |
| `pnpm format` / `pnpm format:check` | Format / check formatting               |
| `pnpm typecheck`                    | Type-check all packages                 |
| `pnpm test` / `pnpm test:e2e`       | Run tests                               |
| `pnpm build`                        | Build everything                        |
| `pnpm commit`                       | Guided Conventional Commit              |
| `pnpm changeset`                    | Record a running-app change for release |
| `pnpm gen:feature <entity>`         | Generate a backend feature (template)   |
| `pnpm contract:generate`            | Regenerate the API contract + types     |
| `pnpm docs:check`                   | Check docs for broken links/stale terms |
| `pnpm clean`                        | Remove build output and caches          |

Versioning and releases: [RELEASING.md](RELEASING.md).

## Codespace specifics

The single home for how a GitHub Codespace differs from a local machine.

- **Docker blocks container-to-container traffic.** The `migrate` and `api`
  containers cannot reach `db`, so `docker compose up` of the full stack fails
  at `migrate` (Prisma `P1001`). Run the apps with `pnpm dev` on the Codespace
  itself against the `db` container, which `setup.sh` starts and publishes on
  port 5432. To smoke-test a built image, run it with `--network host`.
- **Forwarded-port origins.** In a browser Codespace the web app is served from
  `https://<codespace>-5173.app.github.dev`. Add that address to `CORS_ORIGINS`
  in `.env` (comma-separated, after the defaults) and restart `pnpm dev`, or
  sign-in fails with `Invalid origin`.
- **The `app_test` database for API e2e.** Suites run only against a database
  whose name ends in `_test` ([TESTING.md](TESTING.md#test-database-isolation)).
  Create it once in the dev container, then follow TESTING.md's prerequisites:

  ```bash
  docker compose exec db createdb -U app app_test
  ```

- **Git worktrees need a full `pnpm install`.** Filtered installs leave workspace
  packages unlinked, and the git hooks need `node_modules`. Then
  `pnpm --filter @repo/api prisma:generate` and `pnpm --filter @repo/types build`.
- **Restart dev servers by port, not by name.** Stop `pnpm dev` with Ctrl+C in its
  terminal. If it runs in the background, stop whatever listens on the dev ports
  and check they are free:

  ```bash
  fuser -k 3000/tcp 5173/tcp
  ss -ltnp | grep -E ':(3000|5173)\b' || echo "ports free"
  ```

  Never use `pkill -f` with a pattern such as `vite` or `node.*vite`: it matches
  the shell running the command and kills it.

- **An old `blank-app-db-1` container** may still hold port 5432 — see
  [Migrating the old dev database container](#migrating-the-old-dev-database-container).
- The dev container asks for 4 CPUs and 8 GB of memory and forwards ports 5173,
  3000 and 5432.

## Monorepo notes

- **Turborepo** runs tasks across packages with caching; task graph is in
  [`turbo.json`](../turbo.json).
- **pnpm workspaces** link local packages; reference them as `@repo/*` and pin
  shared dependency versions via the catalog in
  [`pnpm-workspace.yaml`](../pnpm-workspace.yaml).
- Add a dependency to a specific package:
  `pnpm --filter @repo/web add <pkg>`.

## Workflow

The delivery process — change classes, approvals, reviews and releases — is in
[`PROCESS.md`](PROCESS.md). The mechanics:

- Branch from up-to-date `main` as `feat/<slug>`, `fix/<slug>`, `docs/<slug>`
  or `chore/<slug>`; rebase rather than merge `main` in.
- Commit with [Conventional Commits](https://www.conventionalcommits.org/)
  (`pnpm commit` prompts for one); types and scopes are in
  [`commitlint.config.js`](../commitlint.config.js).
- Before pushing, run what CI enforces:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check`,
  plus `pnpm contract:generate` after an API change.
- Open a PR into `main` using the
  [template](../.github/pull_request_template.md); it is squash-merged with a
  Conventional Commit title.
- Report security issues privately, never in a public issue
  ([`SECURITY.md`](../SECURITY.md)).

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
- **Port already in use:** stop the process on 5173/3000 (see
  [Codespace specifics](#codespace-specifics)); on 5432, check for an old
  `blank-app-db-1` container.
- **Stale build issues:** `pnpm clean && pnpm install`.
- **`Cannot find module '@repo/types/dist/…'`** when running an API script
  directly: build the shared package first, `pnpm --filter @repo/types build`
  (Turborepo tasks do this automatically).
