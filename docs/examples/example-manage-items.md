<!--
WORKED EXAMPLE — illustrates the delivery process (docs/PROCESS.md) end to end
for a GENERIC feature. It is NOT an approved spec and NO code has been written.
It shows how the feature-spec + implementation-plan templates are filled in,
including diagrams. Replace "Item" with your real entity when you build.
-->

# Feature Spec (EXAMPLE): Manage items

> ⚠️ **Illustrative only.** A deliberately domain-neutral example — each user
> keeps their own list of "items" — that demonstrates the process on the base
> repo. Nothing here is implemented.

- **Status:** Draft (example)
- **Author(s):** Solution Architect (example)
- **Date:** 2026-09-15
- **Related ADR(s):** none (uses existing architecture: ADR-0015, ADR-0016, ADR-0017)

## 1. Business understanding

**Problem.** A signed-in user needs to capture and browse a simple collection of
"items" (a stand-in for whatever your first real entity is) — create them, see
them in a list, and open one.

**Users.** Any signed-in user. Accounts are individual (ADR-0016): each user
sees and manages only their own items; nothing is shared.

**Primary use cases.** (1) Create an item; (2) list my items; (3) view one item.

**User journey (happy path).** The user opens "Items" → "Add item" → enters a
name (and optional details) → saves → the item appears at the top of the list.

**Success criteria.** A user completes the primary action in < 30s (p90); list
p95 < 200ms.

**Open questions.** _Critical:_ none for the example. _Non-critical:_ what fields
does a real "item" need? **Default:** name + description + status; extend later.

## 2. Functional requirements

**US-1** — As a user, I want to create an item, so that I can keep track of it.

- **Given** I'm signed in **when** I submit a valid item **then** it's created
  with status `DRAFT`, owned by me, and shown in my list.
- **Given** an invalid payload (empty name) **when** I submit **then** I get 422
  with field errors and nothing is saved.
- **Given** I'm not signed in **when** I call the API **then** I get 401.

**US-2** — As a user, I want to list my items (newest first, paginated), with a
designed empty state when I have none.

**US-3** — As a user, I want to open one of my items.

- **Given** an item owned by someone else **when** I request it by id **then** I
  get the same 404 as for a missing item (it is never revealed).

**Access.** Owner-based (ADR-0016; rules in `docs/SECURITY_STANDARDS.md` →
Authorisation): creates take the owner from the session, lists are scoped to the
caller, and reads check ownership on the loaded row.

**Validation.** `name` 1–120 chars; `description` ≤ 2000; `status` in an enum.
Zod (web) and class-validator (API); any limit both sides must share goes in
`@repo/types` (ADR-0017).

**Error scenarios.**

| Scenario                        | Detection       | Result           | Status |
| ------------------------------- | --------------- | ---------------- | ------ |
| Not signed in                   | auth guard      | redirect/sign in | 401    |
| Invalid payload                 | DTO validation  | field errors     | 422    |
| Item missing or owned by others | ownership check | not found        | 404    |

## 3. Technical analysis

| Area     | Impact | Notes                                                               |
| -------- | ------ | ------------------------------------------------------------------- |
| Frontend | med    | `items` feature: list route + create form (DataTable/Form)          |
| Backend  | med    | `items` module generated with `pnpm gen:feature item`               |
| Database | med    | new `items` table owned by `users`; index on `(owner_id, status)`   |
| API      | med    | `POST /api/v1/items`, `GET /api/v1/items`, `GET /api/v1/items/:id`  |
| Security | med    | ownership checks (anti-IDOR); validated DTOs                        |
| Testing  | med    | unit (service) + API e2e (Supertest) + web component/e2e (with axe) |

**Dependencies.** None beyond the live auth skeleton (Better Auth, `/api/v1/me`).

## 4. Solution design

### Data flow (create)

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web (RHF + Zod, apiClient)
  participant A as API (auth guard, ValidationPipe)
  participant Sv as ItemsService
  participant DB as PostgreSQL
  U->>W: fill add-item form
  W->>A: POST /api/v1/items { name } (session cookie)
  A->>A: authenticate → principal; validate DTO
  A->>Sv: create(principal, dto)
  Sv->>DB: INSERT (owner_id = principal, created_by, status = DRAFT)
  DB-->>Sv: row
  Sv-->>A: item
  A-->>W: 201 { data: item }
```

### Database changes (design sketch — not committed)

`pnpm gen:feature item` adds the `Item` model from the template: snake_case
columns, UUID v7, `timestamptz`, `owner_id` → `users.id`, soft delete, auditing,
optimistic-locking `version`, and `@@index([ownerId, status])`. Design the real
fields with the database-architect agent, then `prisma:migrate`.

### API changes

| Method | Path                | Access                    | Returns                      |
| ------ | ------------------- | ------------------------- | ---------------------------- |
| POST   | `/api/v1/items`     | signed in; owner = caller | 201 `{ data: Item }`         |
| GET    | `/api/v1/items`     | caller's items only       | 200 `{ data: Item[], meta }` |
| GET    | `/api/v1/items/:id` | owner only (else 404)     | 200 `{ data: Item }` / 404   |

### Implementation approach

Generate the backend `items` module from the reference template
(`docs/REFERENCE_FEATURE.md`), regenerate the API contract so the web gets typed
paths, and build the frontend `items` feature per `FRONTEND_ARCHITECTURE.md`.

---

# Implementation Plan (EXAMPLE)

### Epic: First feature

#### Milestone: Create & view items

- **Task 1 — Generate the `items` feature.** (S) `pnpm gen:feature item`; adapt
  fields; `prisma:migrate --name add_items`; `pnpm contract:generate`.
- **Task 2 — Items API (create/list/get).** (M) Business rules, DTO validation,
  pagination; unit + e2e tests green; update API.md if conventions changed.
- **Task 3 — Items list route.** (M) DataTable + empty/loading/error states,
  query hooks on `apiClient`.
- **Task 4 — Add-item form.** (M) RHF + Zod on the accessible Form primitive,
  mutation invalidating the list.

### Sequencing

Task 1 → 2 (backend slice) → 3 → 4 (UI slice). Each PR meets the Feature
Completion Criteria.

> Next step per the process: **get approval on this spec + plan before writing
> any code.**
