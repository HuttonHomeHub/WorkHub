# Claude Code agents

The canonical guide to WorkHub's subagents: what each owns, when it runs, and
the report every reviewer returns. [`CLAUDE.md`](../../CLAUDE.md) §7 links here;
the process they serve is [`docs/PROCESS.md`](../../docs/PROCESS.md).

Agents do not run on their own. The planner runs from `/feature`; reviewers run
from `/review`, which picks them by the paths a diff touches. Each file has
frontmatter `name` (equal to its filename), `description`, `tools` and `model` —
`pnpm docs:check` enforces the first two.

## Trigger matrix

| Agent                      | Owns                                                                                                               | Run when the diff touches                                                                                                 | Tools / model                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **planner**                | Classifying a change; feature docs and ADR drafts; design across data, API and desktop UI                          | Before any Feature or Architectural change (`/feature`, `/adr`)                                                           | Read, Grep, Glob, Bash, Write, Edit (docs only) / opus                       |
| **ui-reviewer**            | Desktop UX, state coverage, copy, tokens and no one-off styling, component API, bundle and render cost             | `apps/web/src/**`                                                                                                         | Read, Grep, Glob, Bash / sonnet                                              |
| **accessibility-reviewer** | WCAG 2.2 AA: keyboard, focus, landmarks, status messages, contrast, reflow                                         | Interactive UI in `apps/web/src/**`                                                                                       | Read, Grep, Glob, Bash / sonnet                                              |
| **backend-reviewer**       | REST/OpenAPI conventions, envelopes, contract drift, pagination, query efficiency                                  | Controllers, DTOs, services, repositories in `apps/api/src/**`                                                            | Read, Grep, Glob, Bash / sonnet                                              |
| **security-reviewer**      | Auth, sessions, passkeys, ownership 404s, validation, secrets, proxy trust, rate limits, headers, new dependencies | `apps/api/src/common/{auth,guards}/**`, `apps/api/src/config/**`, data access, auth UI, `package.json` dependency changes | Read, Grep, Glob, Bash / opus                                                |
| **database-architect**     | Schema, constraints, indexes, migration safety                                                                     | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**` — **before** writing a migration                         | Read, Grep, Glob, Bash, Write, Edit (schema, migrations, DATABASE.md) / opus |
| **test-engineer**          | API e2e, unit and Playwright + axe tests; red-first regression tests                                               | Behaviour changed without matching tests, or a bug fix                                                                    | Read, Grep, Glob, Bash, Write, Edit (tests only) / sonnet                    |
| **devops-reviewer**        | Workflows, release path, Changesets invariants, images, compose, exposure, secrets                                 | `.github/**`, `**/Dockerfile`, `docker-compose*.yml`, nginx config, `.changeset/config.json`                              | Read, Grep, Glob, Bash / sonnet                                              |

Every agent treats [`docs/PRODUCT.md`](../../docs/PRODUCT.md) and ADR-0019 as
winning over any standards document still marked "Pending rewrite".

## Reviewer output contract

```text
Verdict: Approve | Approve with suggestions | Changes required

Blocking
| file:line | rule (owning doc) | fix |

Suggestions
- file:line — suggestion

Commands run / evidence
- `command` → result

Not checked
- what, and why
```

- **Blocking** means a documented rule is broken; the owning doc is cited.
- Empty sections say "None". A reviewer never approves by silence.
- Findings are advice: reproduce each blocking finding before fixing it, and
  record dismissals with a reason in the PR body (PROCESS.md).

## Skills

Recurring workflows live in [`.claude/skills/`](../skills/README.md): `/ship`,
`/review`, `/feature`, `/deps`, `/release`, `/adr`.
