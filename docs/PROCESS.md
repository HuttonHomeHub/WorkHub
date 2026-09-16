# Delivery process

How a change goes from idea to `main` in WorkHub: one developer working with
Claude Code, no human reviewers. This is the canonical process;
[CLAUDE.md](../CLAUDE.md) §3 keeps only the summary table.

## Change classes

Classify before starting. Each **escalation trigger** raises the class by at
least one: a database migration; auth or ownership code; a new runtime
dependency or service; a breaking OpenAPI change; a change to a CI or security
gate.

| Class             | Examples                                                            | Gates                                                                                                                         |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Trivial**       | Typo, docs wording, dependency patch                                | CI green; Conventional PR title                                                                                               |
| **Small**         | Bug fix, contained tweak; one PR, no schema or contract break       | A 3–5 bullet plan in chat; a regression test for a bug; `/review` by path; docs touched; changeset if the running app changed |
| **Feature**       | New capability, model or endpoint; more than one PR                 | Feature doc approved by the owner, then built in slices (below)                                                               |
| **Architectural** | New infrastructure, superseding an ADR, diverging from the template | ADR approved by the owner (below)                                                                                             |

### Feature

1. Run `/feature`. The **planner** agent writes `docs/features/<slug>.md` from
   the [template](templates/feature.md) and returns its open questions.
2. Ask the owner (see [Approval](#approval)); on approval set the doc's Status to
   **Approved**.
3. Build in **slices, one PR each**, every slice with its tests: unit tests where
   there is logic, API e2e for endpoints, and a Playwright journey with axe for
   UI ([TESTING.md](TESTING.md)).
4. Run **database-architect** before writing any migration,
   **security-reviewer** on data access or auth, and
   **accessibility-reviewer** on UI — plus the rest of `/review`'s path matrix
   ([agents](../.claude/agents/README.md)).
5. When the last slice lands, update the feature doc to as-built (Status
   **Shipped**) and the feature inventory in [PRODUCT.md](PRODUCT.md).

### Architectural

1. Run `/adr`: next number, [template](adr/_template.md), Status **Proposed**,
   index updated.
2. The owner approves; set Status **Accepted** in the same PR.
3. Add a [DECISIONS.md](DECISIONS.md) entry if it reverses a logged decision, and
   a [TECH_DEBT.md](TECH_DEBT.md) row for any debt it creates or retires.

## Approval

- Ask with **AskUserQuestion**: recommended option first, with a one-line why.
  Ask only questions whose answers change the design; state defaults for the
  rest.
- Record the answer where it will be read later: the feature doc's _Decisions_
  section, the ADR, or the PR body.
- **The owner merges.** Claude merges only when told to in the current session,
  only with CI green, and never the Version Packages PR unless asked.

## Reviewer findings

Reviewer agents are advisors. For each **blocking** finding, reproduce it (read
the code, run the test or command) before fixing. If a finding is wrong or out of
scope, dismiss it with a one-line reason in the PR body's _Reviews run_ section.

## Every PR

- Branch `type/slug` from `origin/main` (`feat/`, `fix/`, `docs/`, `chore/`).
- Run the gates and report the results honestly:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check`
  — plus `pnpm contract:generate` after API changes and API e2e when endpoints
  or data access changed ([CLAUDE.md](../CLAUDE.md) §5).
- Conventional Commits with hooks on; a changeset only when the running app
  changed.
- Fill in the [PR template](../.github/pull_request_template.md). `/ship`
  does all of this.
- Squash-merge with a Conventional title — by the owner.

## Releases

A release is cut when the owner wants to deploy: `/release` checks readiness,
confirms with the owner, merges the Version Packages PR, and reports the image
tag and upgrade steps. Versioning and the release mechanics are in
[RELEASING.md](RELEASING.md); the server-side upgrade is in
[OPERATIONS.md](OPERATIONS.md#routine-upgrade).

## Maintenance

- **Dependencies:** when Dependabot PRs pile up, `/deps` combines them into one
  verified PR and records deferred majors in [TECH_DEBT.md](TECH_DEBT.md).
- **Before a release:** a quick standards check — docs still true, `TECH_DEBT`
  and [BACKLOG.md](BACKLOG.md) current, no "Pending rewrite" banner older than
  its planned PR.

## Where work is tracked

- **Now / Next / Later:** [PRODUCT.md](PRODUCT.md#roadmap).
- **Unscheduled candidates:** [BACKLOG.md](BACKLOG.md).
- **Per feature:** [docs/features/](features/README.md).
