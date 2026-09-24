# @repo/types

## 0.2.0

### Minor Changes

- [#58](https://github.com/HuttonHomeHub/WorkHub/pull/58) [`dc3c8f2`](https://github.com/HuttonHomeHub/WorkHub/commit/dc3c8f298196702fecfa02620df3674d445d4896) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Add the hours tracker's settings API: effective-dated work terms, leave years, time adjustments and public holidays, with a one-step import of the England and Wales bank holidays for a year (2019–2040). The release includes a database migration that adds four tables; take a `pg_dump` before upgrading, as the routine upgrade does.

- [#13](https://github.com/HuttonHomeHub/WorkHub/pull/13) [`bcbffed`](https://github.com/HuttonHomeHub/WorkHub/commit/bcbffedec011a3468ed6897792dbf771dd796c73) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Tidy the base repository.
  
  - **Security:** sign-in/sign-up rate limits now apply per client behind reverse proxies (`AUTH_TRUSTED_PROXIES`, `AUTH_RATE_LIMIT_ENABLED`); previously every client shared one bucket in production. Display-name length is enforced by the API, not only the form.
  - **Contracts:** `@repo/types` is a built contract package with shared account rules and API types generated from the committed OpenAPI contract (`pnpm contract:generate`, ADR-0017). The OpenAPI spec now documents the `{ data, meta }` envelope. The web calls the API through a typed `apiClient`; the home page loads `GET /api/v1/me`.
  - **Features:** `pnpm gen:feature <entity>` generates a backend feature from the reference template; CI verifies the output, including its API e2e test. The template's model now has a real `owner` foreign key.
  - **Runtime & tooling:** Node 24 LTS; a dev container for Codespaces; the api Docker image builds again (pnpm 10 deploy); `pnpm docs:check` guards the docs.
