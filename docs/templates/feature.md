# <Feature name>

<!-- Copy to docs/features/<slug>.md. Delete guidance comments and any Design
subsection that does not apply. Keep it short: this doc stays as living
documentation after the feature ships. -->

- **Status:** Draft | Approved | In progress | Shipped
- **Change class:** Feature | Architectural (link the ADR)

## Problem & outcome

<!-- What the owner cannot do today, and what changes when this ships. -->

## Acceptance criteria

- [ ] <observable behaviour — each one maps to a test>

## Design

### Data model

<!-- Models, columns, indexes, constraints (database-architect). owner_id, soft
delete and optimistic locking per DATABASE.md. -->

### API

<!-- Endpoints (method, path, status codes), DTOs, errors; contract impact. -->

### UI

<!-- Desktop layout (≥ 1280px): sidebar entry, list/detail panes, density.
URL state (filters, selection, pane). Command palette commands. Loading, empty,
error states; undo for destructive actions. -->

## Slices

<!-- One PR each, in order; every slice keeps main releasable. -->

1. **<slice>** — <scope>. Tests: <unit / API e2e / Playwright + axe>.

## Decisions & open questions

<!-- Questions for the owner, each with a recommended default. Record the answer
and date here once decided. -->

## As-built notes

<!-- Filled in as slices land: deviations from the design, follow-ups, links to
PRs. -->
