---
'@repo/api': minor
'@repo/web': minor
'@repo/types': minor
---

Tidy the base repository.

- **Security:** sign-in/sign-up rate limits now apply per client behind reverse proxies (`AUTH_TRUSTED_PROXIES`, `AUTH_RATE_LIMIT_ENABLED`); previously every client shared one bucket in production. Display-name length is enforced by the API, not only the form.
- **Contracts:** `@repo/types` is a built contract package with shared account rules and API types generated from the committed OpenAPI contract (`pnpm contract:generate`, ADR-0017). The OpenAPI spec now documents the `{ data, meta }` envelope. The web calls the API through a typed `apiClient`; the home page loads `GET /api/v1/me`.
- **Features:** `pnpm gen:feature <entity>` generates a backend feature from the reference template; CI verifies the output, including its API e2e test. The template's model now has a real `owner` foreign key.
- **Runtime & tooling:** Node 24 LTS; a dev container for Codespaces; the api Docker image builds again (pnpm 10 deploy); `pnpm docs:check` guards the docs.
