# Database standards

> The canonical home of WorkHub's schema, migration and query rules:
> **PostgreSQL 17 + Prisma 6**. `apps/api/prisma/schema.prisma` is the source of
> truth for the model; the reference template
> (`apps/api/examples/reference-feature/schema.reference.prisma`) shows a domain
> table that follows every rule here. HTTP-facing shapes are in
> [API.md](API.md); layering is in [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md).

WorkHub has one owner, one API instance and one database at personal scale
([PRODUCT.md](PRODUCT.md)). The data is the one thing that cannot be rebuilt, so
the rules favour integrity and safe change over throughput. Rules marked
**(planned)** are the standard for new code but not yet implemented; each is
tracked in [BACKLOG.md](BACKLOG.md) or PRODUCT.md's [roadmap](PRODUCT.md#roadmap).

## Principles

1. **The database enforces integrity.** Foreign keys, `NOT NULL`, `CHECK` and
   unique constraints are the last line of defence, not an afterthought to
   validation.
2. **Migrations are the only way to change the schema** — reviewed, committed,
   applied by `prisma migrate deploy`. Never edit a database by hand.
3. **Prisma only, parameterised always.** Raw SQL goes through the tagged
   template `$queryRaw`/`$executeRaw`; never `$queryRawUnsafe` or string
   concatenation ([SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#injection-and-output)).
4. **Repositories are the only Prisma consumers** (ADR-0008), with the one
   exception for opening transactions described below.
5. **Measure before optimising** (see [Queries](#queries-and-indexes)).

## Naming

- **Tables:** plural `snake_case` (`time_entries`); **columns:** `snake_case`.
  Prisma fields stay `camelCase` and map with `@map` / `@@map`.
- **Primary key:** `id`. **Foreign keys:** `<singular>_id`; the owning user is
  always `owner_id` (ADR-0016).
- **Indexes** `idx_<table>_<cols>`, **unique** `uq_<table>_<cols>`, **checks**
  `ck_<table>_<rule>` — where you name them in SQL. Prisma's generated names are
  acceptable for indexes it declares.
- **Enums:** PascalCase type in Prisma, `SCREAMING_SNAKE_CASE` values.
- **Booleans** are positive: `is_billable`, not `is_not_billable`.

## Standard columns

Every **domain** table carries:

| Column       | Prisma                                                  | Purpose                                               |
| ------------ | ------------------------------------------------------- | ----------------------------------------------------- |
| `id`         | `String @id @default(uuid(7)) @db.Uuid`                 | UUID v7: time-ordered, good index locality, no counts |
| `owner_id`   | `String @map("owner_id") @db.Uuid` + relation to `User` | Ownership (ADR-0016); every query filters by it       |
| `created_at` | `DateTime @default(now()) @db.Timestamptz(3)`           | When the row was created                              |
| `updated_at` | `DateTime @updatedAt @db.Timestamptz(3)`                | Maintained by Prisma on every update                  |
| `deleted_at` | `DateTime? @db.Timestamptz(3)`                          | [Soft delete](#soft-delete)                           |
| `version`    | `Int @default(1)`                                       | [Optimistic locking](#optimistic-locking)             |

**No actor columns (who created or last changed a row) and no audit table.** With
one owner they would only ever name the same user (ADR-0019). Security-relevant events go to the
structured logs instead ([OBSERVABILITY.md](OBSERVABILITY.md#auth-security-events)).

The four Better Auth tables (`users`, `sessions`, `accounts`, `verifications`)
follow the naming and type rules but not the domain columns: the library owns
their rows. Check Better Auth's upgrade notes before renaming anything in them.

## Data types

| Data                         | Type                               | Notes                                                                                                                                      |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| An **instant** (happened at) | `timestamptz(3)`                   | Stored in UTC; sent as ISO-8601 with `Z` ([API.md](API.md#dates-money-and-other-values))                                                   |
| A **calendar date**          | `@db.Date`                         | A due date or a day worked — no time or zone. Never store a date as midnight in a `timestamptz`                                            |
| A **wall-clock time**        | `DateTime @db.Time(0)`             | A time of day with no date or zone, such as a working band edge (07:00). Defaults need `dbgenerated("'07:00:00'::time without time zone")` |
| **Money**                    | `Int` pence, column `<name>_pence` | GBP only, so **no currency column**. `Int` holds ±£21.4m; use `BigInt` only for a sum that could exceed it. Never floats                   |
| A quantity with decimals     | `Decimal @db.Decimal(p, s)`        | Exact (hours, rates). Never `Float` for anything summed or compared                                                                        |
| Text                         | `String` (`text`)                  | Length limits live in DTOs; add `varchar(n)` only for a real external limit                                                                |
| A closed set of values       | Prisma `enum`                      | Adding a value is a migration                                                                                                              |
| Opaque structured data       | `Json`                             | Only when never filtered or joined on; otherwise model columns                                                                             |

### Time

- **Instants are UTC in the database and on the wire;** they become
  `Europe/London` only when displayed (the web) or when a rule needs a local
  day.
- **"Today", "this week", "this month" are Europe/London calendar concepts.**
  Compute their boundaries in `Europe/London` — across BST changes — then
  compare against `timestamptz` columns, or compare `date` columns directly.
- **(planned) A `Clock` seam.** Code that reads the current time will inject a
  clock provider so tests can fix time ([TESTING.md](TESTING.md#determinism)).
  Until it exists, `new Date()` is acceptable only in repositories for
  bookkeeping columns (the template's soft delete does this); business rules
  that depend on "now" wait for the seam.

## Constraints and relationships

- **Foreign key on every relationship**, with a deliberate `onDelete`:

  | Relationship                               | `onDelete` | Example                                                                   |
  | ------------------------------------------ | ---------- | ------------------------------------------------------------------------- |
  | `owner_id` → `users.id`                    | `Cascade`  | The template: deleting the account deletes all the user's data            |
  | A part that cannot exist without its whole | `Cascade`  | An invoice's lines                                                        |
  | A reference between independent entities   | `Restrict` | A time entry → its project; the project cannot be hard-deleted while used |
  | An optional reference                      | `SetNull`  | A task's optional category                                                |

  Soft delete never fires these rules — only a hard delete (purge) does.
  Deleting a user is a manual, server-side act; no endpoint or CLI command
  does it today.

- **`NOT NULL` by default;** a nullable column is a decision with a meaning
  (`deleted_at`, an optional description).
- **`CHECK` constraints** for invariants the database can see: non-negative
  pence, `ends_at > starts_at`. Prisma cannot declare them — add them to the
  migration SQL, name them `ck_…`, and note them in a comment on the model.
  Optional columns that only mean something together (a start and an end) get
  a both-or-neither check, `CHECK ((starts_at IS NULL) = (ends_at IS NULL))`; a
  check that compares them passes when both are null, so it needs no guard.
- **Unique constraints** are scoped to the owner (`@@unique([ownerId, name])`),
  and to active rows when the table soft-deletes (below).
- Normalise by default; denormalise only with a measurement and a comment.
- Many-to-many uses an explicit join table with its own `id` and `created_at`;
  join rows are hard-deleted.

## Soft delete

- **User-facing domain entities soft-delete:** `DELETE` sets `deleted_at`. The
  web offers undo through `POST /:id/restore`, which clears `deleted_at` and
  bumps `version` (the template's `restore`). Restore is idempotent, and an
  active row holding the same unique key makes it a 409. Join rows, Better Auth rows and other internal
  bookkeeping hard-delete.
- **Reads exclude deleted rows in the repository.** The template routes every
  query through a private `active(where)` helper that adds `deletedAt: null`,
  including the optimistic-locked update. A new query that skips it is a bug;
  the one deliberate exception is the repository's `findById`, which
  restore needs. A
  Prisma client extension that enforces this across all models is a backlog
  item for when a second model exists.
- **Purging is manual.** Deleted rows stay until the owner empties the trash —
  an explicit, irreversible action with a confirmation dialog
  ([UX_STANDARDS.md](UX_STANDARDS.md)) that hard-deletes that entity's
  soft-deleted rows. There is **no automatic purge** and no retention timer.
- **Uniqueness ignores deleted rows** through a partial unique index, written in
  the migration SQL because Prisma 6 cannot declare it:

  ```sql
  CREATE UNIQUE INDEX uq_projects_owner_id_name_active
    ON projects (owner_id, name) WHERE deleted_at IS NULL;
  ```

  Prisma does not know about the index, so check that later generated
  migrations do not drop it. Name it `uq_<table>_<cols>_active`. When its
  columns are what a list filters and sorts by (`owner_id`, then the date), it
  is also that list's index; do not declare a duplicate `@@index` in Prisma.

## Optimistic locking

Rows the owner edits carry `version`. As in the template's
`updateIfVersionMatches`:

1. The client sends the `version` it last read.
2. The repository runs `updateMany` where `id`, `version` and `deleted_at IS NULL`
   match, setting `version: { increment: 1 }`.
3. A count of `0` means the row changed or disappeared; the service throws
   `ConflictError` → **409**, and the client refetches.

Use this, not `SELECT … FOR UPDATE`, for read-modify-write on a single row. Even
with one owner, two browser tabs are enough to lose an update.

## Transactions

**The standard for new code:**

- **The service owns the boundary.** It opens an interactive transaction with
  `prisma.$transaction(async (tx) => { … })` — the one reason a service may
  inject `PrismaService` — and passes `tx` into repository methods.
- **Repository methods take an optional client:**
  `create(data, db: Prisma.TransactionClient = this.prisma)`. Every query uses
  `db`, so the same method works inside and outside a transaction.
- **Only when needed:** two or more writes that must succeed together, or a
  read whose result a following write depends on. A single `create`/`update` is
  already atomic.
- **Short and local:** no HTTP calls, Better Auth calls, file writes or waits
  inside; Prisma's 5-second interactive timeout is a ceiling, not a target. Do
  side effects after commit.
- **Isolation:** PostgreSQL's default Read Committed plus optimistic locking.
  Use `Serializable` only for an invariant that spans rows, and retry on
  serialisation failure (Prisma `P2034`).

The template's repository methods all take the optional `db` client, so
generated features are transaction-ready; its own use cases are single writes,
so its service opens no transaction.

## Migrations

### Workflow

1. Run **database-architect** before writing the schema change
   ([agents](../.claude/agents/README.md)).
2. `pnpm --filter @repo/api prisma:migrate --name <change>` generates
   `prisma/migrations/<timestamp>_<change>/migration.sql` against your local
   database.
3. **Read the SQL.** Prisma writes a rename as drop-and-add, and a new
   `NOT NULL` column without a default fails on existing rows. Edit the SQL
   when it does not preserve data, and add `CHECK` constraints and partial
   indexes by hand.
4. Commit `schema.prisma` and the migration together. Never edit a migration
   that has been applied anywhere but your machine.

In production the compose `migrate` service runs `prisma migrate deploy`, and the
API starts only after it succeeds ([OPERATIONS.md](OPERATIONS.md#routine-upgrade)). The app is
briefly unavailable during a deploy; for one owner that is accepted, so
migrations do not need to be backward-compatible with the previous image.

### Migration safety

Prisma migrations are **forward-only**: there are no down migrations. The safety
net is a backup and a rehearsal, not a reverse script.

- **Every migration:** take a fresh `pg_dump` of production immediately before
  deploying it (manual until the backup job exists — PRODUCT.md Next).
- **Additive changes** — a new table, a nullable column, a column with a
  default, an index — need nothing more.
- **Destructive or data-transforming changes** — dropping or renaming a table or
  column, narrowing a type, adding `NOT NULL` or a unique constraint to existing
  data, moving data between columns — also need, in the PR's _Risk & rollback_:
  - a **data-preserving plan**: rename in SQL instead of drop-and-add; copy data
    before dropping the source; backfill before adding `NOT NULL`;
  - a **dry run on a restored copy** of the production dump, with the checks you
    ran (row counts, spot queries).
- **Rollback** is restoring the pre-migration dump and redeploying the previous
  `IMAGE_TAG`. Anything written after the dump is lost, so deploy migrations when
  the app is not in use.

## Queries and indexes

The query rules that decide backend performance; budgets are in
[PERFORMANCE.md](PERFORMANCE.md).

- **Bounded:** every list is paginated with a capped `limit`
  ([API.md](API.md#lists)). No `findMany` without `take` on a table that grows.
- **No N+1:** load related rows with `include`/`select` or one `in` query, never
  a query per row in a loop.
- **Select what you use** on wide rows and in lists; let the database filter,
  sort, count and aggregate — never fetch and filter in TypeScript.
- **Batch writes** with `createMany`/`updateMany` inside a transaction.
- **Index real query patterns:** `owner_id` leads every composite index, then
  equality filters, then the sort column (`@@index([ownerId, status, createdAt])`).
  Do not add an index that is a leftmost prefix of another. Remove an index no
  query uses.
- **Measure first.** Before adding an index or rewriting a query, reproduce it on
  a realistic data set (for example 100k rows in the table), read
  `EXPLAIN (ANALYZE, BUFFERS)`, and put the before/after numbers in the PR.
  To see the SQL Prisma sends, pass `log: ['query']` to the client in
  `PrismaService` locally (do not commit it) — Prisma is not wired to the Pino
  logger.

## Data export

The owner can take their data elsewhere with a server CLI command (ADR-0018's
`cli/` pattern):

```bash
pnpm data:export --email <owner email> [--out <file>] [--force]
```

- It writes every domain table the owner owns to one JSON file:
  `{ format: "workhub-export", version, exportedAt, owner, tables }`, each row
  in the API's wire shape (`YYYY-MM-DD` dates, `…Z` instants, `HH:MM` times,
  integer minutes) plus `deletedAt`. Soft-deleted rows are included, so it is
  a faithful copy, not only what the app shows.
- The reads share one `REPEATABLE READ` transaction, so the file is a
  consistent snapshot. The file is created readable by its owner only (mode
  0600), and an existing file is never overwritten without `--force`.
- `EXPORTED_TABLES` in `apps/api/src/cli/export.ts` lists the tables. A unit
  test fails if a Prisma model with an `ownerId` is missing from it, so a new
  table cannot be left out.
- In production, run it inside the `api` container
  ([OPERATIONS.md](OPERATIONS.md#backups-and-restore)). It is not a backup: the
  automated backups remain in PRODUCT.md's Next list.

## Checklist

- [ ] database-architect consulted before the migration
- [ ] Standard columns; UUID v7; `timestamptz(3)` instants, `date` dates, `Int` pence
- [ ] No actor columns or audit table
- [ ] Foreign keys with a chosen `onDelete`; `NOT NULL` by default; `CHECK`s in SQL
- [ ] Owner-scoped unique constraints; partial unique index when soft-deleting
- [ ] Every read through `active()`; optimistic-locked updates
- [ ] Multi-write use cases in a transaction, with `tx` passed to repositories
- [ ] Migration SQL read; destructive changes have a backup, a data plan and a dry run
- [ ] Lists bounded; no N+1; indexes match the queries; numbers for any tuning
