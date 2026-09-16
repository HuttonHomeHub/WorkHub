# Backend performance

> The canonical home of WorkHub's backend performance budgets and how to measure
> against them. The query rules that meet these budgets are in
> [DATABASE.md](DATABASE.md#queries-and-indexes); browser budgets are in
> [FRONTEND_QUALITY.md](FRONTEND_QUALITY.md).

WorkHub serves **one owner from one API instance and one PostgreSQL database**
on the owner's hardware ([PRODUCT.md](PRODUCT.md#scale)). There is no concurrent
load to plan for, no horizontal scaling and no shared cache. What matters is that
each request is fast for one person as their data grows over years.

## Budgets

Measured as **server time** (the request log's `responseTime`) on the production
host shape, with a **personal data set of 100k rows in the largest table**:

| Request                                                  | Budget                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| A read: one resource, or one page of a list (≤ 200 rows) | < 100 ms                                                                  |
| A write: create, update, soft delete                     | < 150 ms                                                                  |
| A list with `meta.total`, a search (`q`) or a date range | < 250 ms                                                                  |
| Anything slower (an export, a report)                    | Designed in its feature doc: streamed, paginated or run in the background |

The budgets are starting points ([TECH_DEBT.md](TECH_DEBT.md)); revisit them with
real data once WorkHub has a domain.

## Measure first

- **Reproduce before tuning.** Seed the table to the budget's data size in a
  local database, time the endpoint (the request log, or `Date.now()` around the
  call in an API e2e test), and find the slow query with Prisma query logging and
  `EXPLAIN (ANALYZE, BUFFERS)` ([OBSERVABILITY.md](OBSERVABILITY.md#slow-queries)).
- **Change one thing, measure again,** and put before/after numbers in the PR.
- **The usual fixes, in order:** a missing or wrong-order index; an N+1; an
  unbounded or over-wide query; aggregation done in TypeScript instead of SQL.
- **Caching is the last resort.** No shared cache (ADR-0019); in-process
  memoisation only for a measured hot path with an explicit invalidation rule.
- **Slow work leaves the request** only when a feature needs it, using the
  deferred defaults in ADR-0019 (pg-boss or an in-process scheduler).
- Do not load-test for concurrency or tune connection pools for scale that does
  not exist.

## Checklist

- [ ] Lists bounded and indexed for their filters and sort ([DATABASE.md](DATABASE.md#queries-and-indexes))
- [ ] No N+1; aggregation in SQL
- [ ] Any performance change carries before/after numbers at the stated data size
