<!--
Feature Spec template — Stages 1–4 of docs/PROCESS.md.
Copy to docs/specs/<feature-slug>.md (or attach to the tracking issue) and fill
in. Delete guidance comments. NO application code is written at this stage.
-->

# Feature Spec: <Feature name>

> **Pending rewrite (ADR-0019).** Parts of this document assume a team process and features that may need sharing, teams or several currencies — where it conflicts with [PRODUCT.md](../PRODUCT.md), PRODUCT.md wins.

- **Status:** Draft | In review | Approved | Superseded
- **Author(s):** <name(s)>
- **Date:** YYYY-MM-DD
- **Tracking issue / epic:** #
- **Roadmap link:** <milestone in docs/ROADMAP.md>
- **Related ADR(s):** <ADR-XXXX, or "none">

## 1. Business understanding

### Problem

<What problem is being solved, and why now? Who feels the pain today?>

### Users

<Personas and what each needs. Accounts are individual (ADR-0016): say which data
each user owns and whether anything must be visible to other users.>

### Primary use cases

1. <use case>
2. <use case>

### User journeys

<Happy path end-to-end, plus important alternates. Reference the user-flow
diagram in §4.>

### Expected outcomes

<What changes for the user/business when this ships?>

### Success criteria

<Measurable where possible — e.g. "a user completes the primary action in < 30s",
"p95 list latency < 200ms". How we'll know it worked.>

### Open questions

<Anything unclear. Mark the CRITICAL ones (answers change design/scope). State
your assumed default for the rest so work isn't blocked.>

## 2. Functional requirements

### User stories & acceptance criteria

> **US-1** — As a `<role>`, I want `<capability>`, so that `<benefit>`.
>
> **Acceptance criteria**
>
> - **Given** `<context>` **when** `<action>` **then** `<outcome>`.
> - …

_(repeat per story)_

### Workflows

<Step-by-step behaviour for each use case.>

### Edge cases

<Empty / max / concurrent / partial / boundary conditions and expected behaviour.>

### Access

<Who may do what. The default is owner-based access (ADR-0016, rules in
docs/SECURITY_STANDARDS.md → Authorisation): users act only on resources they
own. If the feature needs sharing, teams, roles, or an admin, flag it as a
CRITICAL question — that supersedes ADR-0016 and needs an ADR first.>

### Validation rules

<Field and domain rules. Types, ranges, lengths, formats. Rules the web and API
must both enforce go in @repo/types (ADR-0017). Money = integer minor units +
currency.>

### Error scenarios

| Scenario                              | Detection         | User-facing result      | Status |
| ------------------------------------- | ----------------- | ----------------------- | ------ |
| <e.g. resource owned by another user> | ownership check   | same "not found" as 404 | 404    |
| <e.g. duplicate name>                 | unique constraint | inline error            | 409    |

## 3. Technical analysis

| Area           | Impact                  | Notes                                       |
| -------------- | ----------------------- | ------------------------------------------- |
| Frontend       | none / low / med / high | routes, components, state, forms            |
| Backend        |                         | modules, services, endpoints                |
| Database       |                         | models, migrations, indexes, constraints    |
| API            |                         | endpoints, contracts, versioning, OpenAPI   |
| Security       |                         | authN/Z, scope, input, secrets, audit       |
| Performance    |                         | query cost, N+1, caching, async, pagination |
| Infrastructure |                         | new services, env/secrets, CI, containers   |
| Observability  |                         | logs, metrics, traces, health               |
| Testing        |                         | unit / API / e2e / a11y needed              |

### Dependencies

<Prerequisites, affected features, third parties, what must land first.>

## 4. Solution design

### Architecture overview

<Components involved and how they fit the existing architecture.>

```mermaid
flowchart LR
  %% components & relationships
```

### Data flow

```mermaid
sequenceDiagram
  %% how data moves for this feature
```

### User flow

```mermaid
flowchart TD
  %% the user's path through the UI
```

### Database changes

<Schema deltas: models, columns, indexes, constraints, relationships. Follow
docs/DATABASE.md. Design with the database-architect agent.>

### API changes

<New/changed endpoints: method, path (`/api/v1/...`), request/response DTOs,
status codes, errors. Follow docs/API.md.>

### Component changes

<New/changed frontend components and where they live. Reuse the design system;
no one-off styling. Note loading/empty/error/success states.>

### Implementation approach & alternatives

<Chosen strategy and why; the main alternatives considered and why not. If
architecturally significant, link the ADR.>

## 5. Links

- Implementation plan: <templates/implementation-plan.md → docs/plans/…>
- Related docs updated by this change: <list>
