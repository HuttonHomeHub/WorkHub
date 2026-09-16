# WorkHub documentation

This directory is the deep reference for WorkHub. [`PRODUCT.md`](PRODUCT.md)
describes the product; each standard below is the canonical home of its rules,
and [`CLAUDE.md`](../CLAUDE.md) links to them.

## Index

| Document                                             | What it covers                                          |
| ---------------------------------------------------- | ------------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)                             | What WorkHub is, plus Now / Next / Later                |
| [PROCESS.md](PROCESS.md)                             | Change classes, approvals, reviews, releases            |
| [features/](features/README.md)                      | Feature docs: plans that become living documentation    |
| [templates/](templates/README.md)                    | Feature doc template (ADR template is in `adr/`)        |
| [ARCHITECTURE.md](ARCHITECTURE.md)                   | System design, components, data flow, boundaries        |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | Frontend structure, state, routing, data, auth, theming |
| [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)   | Modules, DI, validation, errors, jobs, cache, auth/z    |
| [DATABASE.md](DATABASE.md)                           | Schema standards & philosophy (Postgres + Prisma)       |
| [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md)       | Security engineering standards (secure by default)      |
| [OBSERVABILITY.md](OBSERVABILITY.md)                 | Logging, correlation, health, metrics, tracing          |
| [PERFORMANCE.md](PERFORMANCE.md)                     | Caching, async, query optimisation, scalability         |
| [REFERENCE_FEATURE.md](REFERENCE_FEATURE.md)         | The canonical backend feature template                  |
| [API.md](API.md)                                     | REST conventions, versioning, error format, OpenAPI     |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                 | Design tokens, theming, component specs                 |
| [UX_STANDARDS.md](UX_STANDARDS.md)                   | Desktop shell, keyboard, feedback, forms, URL state     |
| [ACCESSIBILITY.md](ACCESSIBILITY.md)                 | WCAG 2.2 AA checklist and how to verify it              |
| [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md)         | Component authoring, naming, keyboard contracts         |
| [FRONTEND_QUALITY.md](FRONTEND_QUALITY.md)           | FE budgets, test matrix, error boundaries, logging      |
| [TESTING.md](TESTING.md)                             | Test strategy, tooling, coverage expectations           |
| [DEVELOPMENT.md](DEVELOPMENT.md)                     | Local environment setup and day-to-day workflow         |
| [DEPLOYMENT.md](DEPLOYMENT.md)                       | Release process, containers, environments               |
| [BACKLOG.md](BACKLOG.md)                             | Candidate work, not yet scheduled                       |
| [DECISIONS.md](DECISIONS.md)                         | Lightweight running decision log                        |
| [TECH_DEBT.md](TECH_DEBT.md)                         | Known debt and remediation intent                       |
| [adr/](adr/)                                         | Formal Architecture Decision Records                    |

## Conventions

- Written in Markdown; diagrams use [Mermaid](https://mermaid.js.org) so they
  render on GitHub and stay diffable.
- Keep docs in lock-step with code — update them in the same PR as the change.
- Prefer linking to a single canonical explanation over duplicating it.
