<div align="center">

# WorkHub

**A private, self-hosted web app for a single owner.**

[![CI](https://github.com/HuttonHomeHub/WorkHub/actions/workflows/ci.yml/badge.svg)](https://github.com/HuttonHomeHub/WorkHub/actions/workflows/ci.yml)
[![CodeQL](https://github.com/HuttonHomeHub/WorkHub/actions/workflows/codeql.yml/badge.svg)](https://github.com/HuttonHomeHub/WorkHub/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Commits-Conventional-fe5196.svg)](https://www.conventionalcommits.org)

</div>

> **Project status: walking skeleton.** Sign-in, a protected shell and
> `/api/v1/me` work end to end; the domain is still to be decided. What WorkHub
> is, who it is for and the product decisions behind it are in
> [`docs/PRODUCT.md`](docs/PRODUCT.md).

WorkHub is used in desktop browsers and runs on the owner's own server with
Docker Compose, behind a reverse proxy. It is a TypeScript monorepo with a React
web client, a NestJS API and PostgreSQL.

## ✨ Tech stack

- **Monorepo:** [Turborepo](https://turbo.build) + [pnpm](https://pnpm.io) workspaces
- **Frontend:** [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev), [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [Lucide](https://lucide.dev)
- **Backend:** [NestJS](https://nestjs.com) + TypeScript
- **Database:** [PostgreSQL](https://www.postgresql.org) via [Prisma](https://www.prisma.io)
- **API:** REST, documented with [OpenAPI](https://swagger.io/specification/)
- **Auth:** [Better Auth](https://www.better-auth.com) (self-hosted) — see [ADR-0003](docs/adr/0003-authentication-with-better-auth.md)
- **Testing:** [Vitest](https://vitest.dev), [Supertest](https://github.com/ladjs/supertest), [Playwright](https://playwright.dev)
- **CI/CD:** GitHub Actions → images on the GitHub Container Registry

## 📁 Repository layout

```text
apps/
  web/        React + Vite client        (@repo/web)
  api/        NestJS REST API            (@repo/api)
packages/
  config/     Shared ESLint + tsconfig   (@repo/config)
  types/      Shared cross-boundary types (@repo/types)
docs/         Product profile, standards, guides, ADRs
scripts/      Repository automation
```

## 🚀 Quick start

**Prerequisites:** Node.js ≥ 24 (see [`.nvmrc`](.nvmrc)), pnpm ≥ 10 (via
`corepack enable`), and Docker (for local PostgreSQL) — or open it in
GitHub Codespaces / a dev container, which sets all of this up for you
([`.devcontainer/`](.devcontainer/devcontainer.json)).

```bash
# 1. Clone and enter
git clone https://github.com/HuttonHomeHub/WorkHub.git && cd WorkHub

# 2. Bootstrap (installs deps, creates .env, starts Postgres)
./scripts/setup.sh

# 3. Run everything in dev mode
pnpm dev
```

Then open <http://localhost:5173> and sign in with the development account that
`setup.sh` seeds and prints ([`docs/DEVELOPMENT.md` → Accounts](docs/DEVELOPMENT.md#accounts-no-email)).
Public sign-up is off (ADR-0018).

Everyday commands, accounts, the full stack in containers and Codespace
specifics are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). Running WorkHub
on your own server (pinned GHCR images behind your reverse proxy) is in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## 📚 Documentation

| Document                                                         | Purpose                                 |
| ---------------------------------------------------------------- | --------------------------------------- |
| [`docs/PRODUCT.md`](docs/PRODUCT.md)                             | What WorkHub is, and Now / Next / Later |
| [`CLAUDE.md`](CLAUDE.md)                                         | Operating manual for Claude Code        |
| [`docs/PROCESS.md`](docs/PROCESS.md)                             | How changes go from idea to merged      |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                   | System design and boundaries            |
| [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md) | Frontend architecture & patterns        |
| [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md)   | Backend architecture & patterns         |
| [`docs/DATABASE.md`](docs/DATABASE.md)                           | Database standards & philosophy         |
| [`docs/SECURITY_STANDARDS.md`](docs/SECURITY_STANDARDS.md)       | Security engineering standards          |
| [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md)                 | Logging, health and alerts              |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)                     | Performance standards                   |
| [`docs/REFERENCE_FEATURE.md`](docs/REFERENCE_FEATURE.md)         | The canonical backend feature template  |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)                 | Design tokens, theming, components      |
| [`docs/UX_STANDARDS.md`](docs/UX_STANDARDS.md)                   | Project-wide UX principles              |
| [`docs/COMPONENT_LIBRARY.md`](docs/COMPONENT_LIBRARY.md)         | Component guidelines & lifecycle        |
| [`docs/FRONTEND_QUALITY.md`](docs/FRONTEND_QUALITY.md)           | FE testing, a11y, perf, bundle          |
| [`docs/API.md`](docs/API.md)                                     | REST/OpenAPI conventions                |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)                     | Local dev environment guide             |
| [`docs/TESTING.md`](docs/TESTING.md)                             | Test strategy and tooling               |
| [`docs/RELEASING.md`](docs/RELEASING.md)                         | Versioning, releases and images         |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md)                       | Self-hosting runbook                    |
| [`docs/adr/`](docs/adr/)                                         | Architecture Decision Records           |
| [`.claude/agents/`](.claude/agents/README.md)                    | Claude Code review and planning agents  |
| [`SECURITY.md`](SECURITY.md)                                     | Reporting vulnerabilities               |

## 📄 License

[MIT](LICENSE) © The WorkHub authors
