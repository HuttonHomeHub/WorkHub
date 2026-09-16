# Frontend Quality Standards

> The quality bar for `apps/web`: performance budgets, the browser and viewport
> matrix, error handling, client logging and the frontend definition of done.
> Test strategy and the coverage rule belong to [`TESTING.md`](TESTING.md);
> accessibility belongs to [`ACCESSIBILITY.md`](ACCESSIBILITY.md); backend
> performance belongs to [`PERFORMANCE.md`](PERFORMANCE.md).

The shape being optimised for (PRODUCT.md): **one owner, one desktop browser
window on a broadband connection, talking to a single API instance on the
owner's own hardware**. There is no phone, no flaky radio link and no cold CDN
edge. That makes the budgets tighter than a public SaaS would set, and it makes
_interaction_ latency — not first paint — the thing that matters.

## Performance budgets

Measure on a **1920×1080 Chromium window, unthrottled, on broadband**, against
the API running locally or on the owner's host. Re-baseline once WorkHub is
deployed; an unmeasured claim is not a result
([TECH_DEBT.md](TECH_DEBT.md) — targets are still estimates).

| Budget                                     | Target                                    | Hard limit | Measure with                                        |
| ------------------------------------------ | ----------------------------------------- | ---------- | --------------------------------------------------- |
| **Cold LCP** (first load, sign-in → shell) | ≤ 1.5s                                    | 2.5s       | Lighthouse, or `PerformanceObserver` in a journey   |
| **INP** (p75 across a session)             | ≤ 100ms                                   | 200ms      | Chrome DevTools Performance, web-vitals attribution |
| **CLS**                                    | ≤ 0.05                                    | 0.1        | Lighthouse                                          |
| **Warm route transition** (data cached)    | ≤ 100ms                                   | 200ms      | DevTools Performance trace of the navigation        |
| **Cold route transition**                  | ≤ 1s, and **no pending UI before ~300ms** | 2s         | Same, plus the router's `defaultPendingMs`          |
| **Keypress → character painted**           | ≤ 50ms                                    | 100ms      | DevTools Performance, typing in the busiest form    |
| **Command palette open → input focused**   | ≤ 100ms                                   | 150ms      | Same                                                |
| **Long tasks**                             | none > 50ms on any interaction            | —          | DevTools "Long tasks" / `PerformanceObserver`       |
| **List virtualisation**                    | required above **~200 rows**              | —          | Row count in the query                              |

Rules behind the numbers:

- **No spinner before ~300ms.** A flashed spinner reads as jank. Under 300ms show
  the old content; over it, show the pending component
  ([UX_STANDARDS.md](UX_STANDARDS.md#timing)).
- **Skeletons only on first load**, matching the final layout so nothing shifts.
  A refetch of data already on screen never replaces it with a skeleton.
- **Reserve space** for anything async — no layout shift from late content.
- **Optimise after measuring.** Attach the trace or the number to the PR; "felt
  faster" is not evidence.

### Bundle size — advisory

Budgets, not a gate: **initial critical-path JS ≤ 200KB gzipped**, **each lazy
route chunk ≤ 150KB gzipped**. They are advisory until a CI check lands
([BACKLOG.md](BACKLOG.md)).

How to measure:

```bash
pnpm --filter @repo/web build        # Vite prints each chunk, raw and gzipped
```

Compare the chunk list before and after your change. A dependency that adds more
than ~30KB gzipped needs a justification in the PR (size, maintenance,
tree-shakeability, and what it replaces). Import by name, never a whole library
for one function.

### Code splitting

- **Route-based splitting by default** — `autoCodeSplitting` is on in
  `vite.config.ts`, so every route is its own chunk. The shell and critical path
  stay in the initial bundle.
- **Lazy-load heavy, rarely-used UI** (charts, editors, the odd big dialog)
  behind a dynamic import with a Suspense fallback.
- **Prefetch on intent** — `defaultPreload: 'intent'` is set in `app/router.tsx`,
  so hovering or focusing a link warms the route.

### Memory hygiene

The owner will leave a tab open for days. Long-lived tabs leak in ways a
short-session app never notices.

- `gcTime` is 5 minutes (`lib/query/client.ts`); don't raise it to keep a big
  list "just in case".
- Every `addEventListener`, `matchMedia` listener, `setInterval`,
  `ResizeObserver`, `IntersectionObserver` and `AbortController` is cleaned up in
  the effect that created it.
- Virtualised lists must actually unmount off-screen rows.
- No unbounded client-side accumulation — no infinite scroll that keeps every
  page in memory, no growing in-memory log.
- Spot-check with DevTools → Memory: take a heap snapshot, navigate around for a
  few minutes, snapshot again; detached DOM nodes that keep growing are a bug.

## Test matrix

The **target** matrix for user-facing UI work:

| Dimension | Values                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| Browsers  | **Chromium** and **Firefox** (Safari is not supported — PRODUCT.md)                                               |
| Viewports | **1280×800** (the design floor) and **1920×1080**                                                                 |
| Journeys  | The critical flows, with axe assertions on every screen                                                           |
| Keyboard  | One **keyboard-only** journey: sign in, navigate, act, sign out, using no pointer                                 |
| Zoom      | One **400%-zoom reflow check** at 1280×800 (a 320 CSS px viewport): no page-level horizontal scroll, nothing lost |

**What CI runs today, honestly:** `playwright.config.ts` defines chromium,
firefox and webkit projects locally but **CI runs chromium only, at Playwright's
default `Desktop Chrome` viewport**, with axe checks in `e2e/auth.spec.ts`. There
is no keyboard-only journey and no zoom check yet.

The gap is standing debt, not an exemption
([TECH_DEBT.md](TECH_DEBT.md)). Closing it — a Firefox project plus explicit
1280×800 and 1920×1080 viewports in CI, and dropping the unsupported webkit
project — is in [BACKLOG.md](BACKLOG.md) and PRODUCT.md's Next list. Until then,
run the wider matrix locally for UI changes and say in the PR what you ran.

Everything else about tests — the pyramid, the tooling, the coverage rule, the CI
jobs — is in [TESTING.md](TESTING.md).

## Accessibility

**WCAG 2.2 AA is a merge requirement.** The checklist, the verification methods
and the known gaps live in [ACCESSIBILITY.md](ACCESSIBILITY.md). `pnpm lint`
runs `eslint-plugin-jsx-a11y` in CI, and Playwright journeys assert with axe.

## Error boundaries

- An error boundary wraps the **app root** — `RootErrorBoundary` in
  `app/providers.tsx` — with a friendly fallback and a reload action
  (**implemented**). It currently reports to `console.error`.
- **Route-level recovery is planned:** the router has no
  `defaultErrorComponent`, so a render fault in one screen still blanks the app.
  Adding per-route `errorComponent`s, plus the router's pending defaults, is
  tracked in [TECH_DEBT.md](TECH_DEBT.md) and PRODUCT.md's Next list.
  `app/providers.tsx`'s comment claiming route-level errors are already handled
  is aspirational — treat it as the target, not the state.
- **Data errors are not boundary errors.** TanStack Query states render inline
  errors with a retry; boundaries catch render and runtime faults
  ([FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)).
- A fallback never shows a raw message or stack trace.

## Client error reporting

WorkHub has one user and no growth funnel, so there is **no analytics, no
consent banner and no event taxonomy**. What it needs is to know when the client
broke: unhandled errors and error-boundary reports should be posted to the API so
they land in the server log with a correlation id, instead of dying in a browser
console the owner never opens. That is **planned**, not built — today
`RootErrorBoundary` logs to the console. Logging and correlation are owned by
[OBSERVABILITY.md](OBSERVABILITY.md).

## Client logging

- Log through a small logger, not scattered `console.*`. `no-console` is enforced
  by lint; `warn` and `error` are permitted deliberately.
- Levels: `error` (report), `warn` (recoverable or degraded), `debug` (dev only,
  stripped from production builds).
- Never log secrets, tokens, session identifiers or personal data. Include the
  route for context and line up with the API's correlation ids.

## Definition of done (frontend quality)

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` pass
- [ ] New or changed UI has behaviour tests; new flows have a Playwright journey
- [ ] Checked at 1280×800 and 1920×1080, in light and dark, in Chromium **and**
      Firefox
- [ ] [ACCESSIBILITY.md](ACCESSIBILITY.md) checklist done for what changed,
      including a keyboard-only pass and a 400%-zoom look
- [ ] Loading, empty, error and success states covered; no layout shift
- [ ] Route lazy-loaded; heavy deps split; chunk sizes compared before/after
- [ ] Interaction stays within the budgets above, with a number to show if you
      changed anything on a hot path
- [ ] Listeners, observers and timers cleaned up
- [ ] No raw errors shown to the user; no secrets or personal data in logs
- [ ] The affected docs updated in this PR
