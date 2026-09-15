# @repo/web

The WorkHub web client: **React 19 + TypeScript + Vite**, styled with **Tailwind CSS v4**
and **shadcn/ui** components, using **Lucide** icons.

> **Status:** walking skeleton. The app entry, providers, router, auth feature
> (sign-in / sign-out with a protected shell; the sign-up page only when the API
> enables it, ADR-0018), the typed API
> client (`GET /api/v1/me` on the home page), and base primitives are live. The **architecture** is defined in
> [`docs/FRONTEND_ARCHITECTURE.md`](../../docs/FRONTEND_ARCHITECTURE.md), the
> **design system** in [`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md)
> (tokens implemented in [`src/styles/globals.css`](src/styles/globals.css)),
> and UX/component/quality standards in the sibling docs. Read those before
> building UI.

## Structure (per `docs/FRONTEND_ARCHITECTURE.md`)

```text
src/
  main.tsx          # App entry: providers + router mount
  app/              # App-wide composition (providers, router)
  routes/           # File-based routes (TanStack Router)
  features/         # Feature modules: auth, account (components, api, hooks, schemas)
  components/ui/     # Design-system primitives (shadcn/ui, owned as source)
  components/layout/ # App shell: header, page scaffolds
  hooks/            # Shared React hooks (useTheme)
  lib/              # Typed API client (ADR-0017), query client, cn()
  styles/           # globals.css — design tokens (source of truth)
  test/             # Test setup and utilities
e2e/                # Playwright end-to-end specs
```

## Scripts

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Start the Vite dev server (port 5173)     |
| `pnpm build`     | Type-check and produce a production build |
| `pnpm test`      | Run unit/component tests (Vitest)         |
| `pnpm test:e2e`  | Run end-to-end tests (Playwright)         |
| `pnpm lint`      | Lint with ESLint (includes jsx-a11y)      |
| `pnpm typecheck` | Type-check without emitting               |
