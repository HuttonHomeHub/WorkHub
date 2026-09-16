# Observability

> The canonical home of WorkHub's logging, correlation IDs, auth security events,
> health endpoints and alerting. Backed by ADR-0013, which ADR-0019 partly
> defers: Pino, correlation IDs and health endpoints stand; OpenTelemetry waits.

One owner, one API instance, one database. The questions to answer are "is it
up?", "did last night's backup run?" and "what happened in this request?" —
logs and two alerts answer them. Rules marked **(planned)** are the standard for
new code but not yet built; each is tracked in [BACKLOG.md](BACKLOG.md) or
PRODUCT.md's [roadmap](PRODUCT.md#roadmap).

## Logging

- **Pino via `nestjs-pino`** (`apps/api/src/app.module.ts`): one JSON object per
  line on stdout in production; `pino-pretty` single-line output in development.
- **Level** from `LOG_LEVEL` (default `info`). Use:
  - `error` — a 5xx or a failure that needs the owner's attention (the exception
    filter logs every 5xx with its stack);
  - `warn` — expected but notable: 4xx responses (the filter logs code and path),
    optimistic-lock conflicts, ownership denials, failed sign-ins;
  - `info` — lifecycle and business events (`reference item created`);
  - `debug` — troubleshooting only; off in production.
- **Log through the injected logger**, never `console.log`: `PinoLogger` via
  `@InjectPinoLogger(Service.name)` in services, as the template does. Its lines
  carry the request's context automatically.
- **Log facts and ids, not data:** `{ timeEntryId, userId }`, not the entity or
  the request body.
- **Request log:** `pino-http` writes one `request completed` line per request
  with method, URL, query, status, response time and headers.
- **Redaction** removes `req.headers.authorization`, `req.headers.cookie` and
  `res.headers["set-cookie"]` — the paths that carry credentials in the request
  log. Request bodies are not logged, so the `req.body.password`/`token`/`secret`
  paths are a safety net. Never add a body, a token or a whole entity to a log
  line.

### What is not logged today

- **`/api/auth/*` requests.** Better Auth's handler is mounted in
  `configureApp` with `app.use`, which Express registers before the
  `nestjs-pino` middleware that Nest adds at `app.init()`. Auth requests are
  answered before the request logger runs, so sign-ins (successful or not) leave
  no trace. Verified with an e2e boot on 2026-09-16.
- **Body-parsing failures** (an oversized body, an unsupported charset) happen
  before the request logger too, so they get no request log line. The exception
  filter still logs each as a 4xx warning with a correlation ID, which it
  assigns itself.

## Correlation IDs

- `genReqId` takes an inbound `x-correlation-id` header or generates a UUID,
  uses it as the request id on every log line for that request, and returns it in
  the `x-correlation-id` response header.
- The exception filter includes it (`correlationId`) when it logs an error, so
  a failing request can be found from the response header. For a request that
  failed before the request logger ran, the filter picks the id the same way
  (`common/logging/correlation-id.ts`) and sets the response header.
- Anything that runs outside a request — a future job or scheduled task — creates
  its own id and logs it the same way.

## Auth security events

WorkHub has no audit log (ADR-0019); these events are its security record.
**(planned, required before exposure)** — none are emitted today:

| Event                                  | Level  | When                                                                   |
| -------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `auth.sign_in.succeeded`               | `info` | A session is created                                                   |
| `auth.sign_in.failed`                  | `warn` | Wrong password or unknown email                                        |
| `auth.rate_limited`                    | `warn` | Better Auth's limiter refuses an auth request                          |
| `auth.sign_out`                        | `info` | A session is ended by the owner                                        |
| `auth.sessions.revoked`                | `warn` | All of an account's sessions end (sign out everywhere, password reset) |
| `auth.password.reset`                  | `warn` | `user:reset-password` runs                                             |
| `auth.account.created`                 | `info` | `user:create` runs                                                     |
| `auth.passkey.registered` / `.removed` | `warn` | Once passkeys exist                                                    |

- **Fields:** `event`, `correlationId`, `userId` when the account is known, client
  `ip` (resolved through the trusted proxies) and `userAgent`.
- **Never** the password, the session token, the cookie, or the email address
  that was typed on a failed attempt.
- The request log for `/api/auth/*` should be restored at the same time.

## Health

| Endpoint            | Kind      | Checks                        | Response                                               |
| ------------------- | --------- | ----------------------------- | ------------------------------------------------------ |
| `GET /health`       | Liveness  | None — the process answers    | 200 `{ "data": { "status": "ok", … } }`                |
| `GET /health/ready` | Readiness | A Prisma ping of the database | 200 when up; 503 in the error envelope when it is down |

- Both are `@Public()`, served at the **root, outside `/api`**
  (`setGlobalPrefix('api', { exclude: [...] })`), and report only up/down per
  check.
- The api image's Docker `HEALTHCHECK` calls `/health` inside the container; the
  web image's checks that nginx serves `/`.
- **Reachable through the proxy.** The web container's nginx proxies exactly
  `/health` and `/health/ready` to the API, so `https://<your-host>/health/ready`
  answers 200 when the API and database are up, 503 when the database is down,
  and 502 when the API is not answering. Monitors judge by the status code
  alone: the 503 body is the generic error envelope
  (`{"error":{"code":"ERROR",…}}`), not Terminus's per-check detail.
- A new critical dependency adds a check to `/health/ready` in the same PR.

## Alerts that matter

Two alerts, both delivered to the owner's phone or email, both checked from
**outside the host** so a dead server still alerts:

1. **Uptime** — an external monitor requests readiness every few minutes and
   alerts after two consecutive failures: `https://<your-host>/health/ready`
   ([Health](#health)).
2. **Backup heartbeat (planned)** — the nightly backup pings a dead-man's-switch
   service after the encrypted off-site copy succeeds; a missed ping alerts
   (PRODUCT.md → Data safety).

No dashboards, metrics pipelines or latency alerts: at this scale a person
notices a slow app before a graph does.

## Slow queries

When something feels slow, measure before changing anything
([PERFORMANCE.md](PERFORMANCE.md)):

- **Locally:** pass `log: ['query']` to the Prisma client in `PrismaService`
  temporarily to see the SQL and its timing.
- **On the server (optional, not configured):** start Postgres with
  `-c log_min_duration_statement=200` to log every statement slower than 200 ms,
  then read the `db` container's logs.

## Reading and keeping logs

Container logs use Docker's `json-file` driver capped at 10 MB × 5 files per
service (`docker-compose.prod.yml`); read them with
`docker compose -f docker-compose.prod.yml logs api`. Anything longer-lived is
the owner's choice of log shipping. Log queries, monitoring setup and the other
server procedures are in [OPERATIONS.md](OPERATIONS.md#logs).

## Deferred: OpenTelemetry

Metrics and traces are deferred (ADR-0019). Adopt OpenTelemetry — a new runtime
dependency, so a Feature at least — when a question comes up that logs and
`EXPLAIN` cannot answer.

## Checklist

- [ ] New code logs through `PinoLogger` with ids, not entities or bodies
- [ ] Levels as above; 5xx paths are not swallowed
- [ ] Auth changes emit the security events above
- [ ] A new critical dependency is added to `/health/ready`
- [ ] No secrets, tokens, cookies or personal data in log fields
