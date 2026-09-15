# Claude Code skills

Procedures for WorkHub's recurring workflows. Each lives in
`<name>/SKILL.md` with frontmatter `name` (equal to its directory, enforced by
`pnpm docs:check`) and `description`. They follow
[`docs/PROCESS.md`](../../docs/PROCESS.md) and never override "the owner merges".

| Skill      | Use it to                                                                 |
| ---------- | ------------------------------------------------------------------------- |
| `/ship`    | Run the gates, commit, push and open a PR from the template; watch CI     |
| `/review`  | Pick reviewer agents by path, run them in parallel, verify their findings |
| `/feature` | Plan a Feature with the planner and get the owner's approval              |
| `/deps`    | Combine open Dependabot PRs into one verified PR                          |
| `/release` | Cut a release when the owner asks: checklist, Version Packages PR, images |
| `/adr`     | Draft a Proposed ADR and ask the owner to accept it                       |

Agents they call: [`.claude/agents/README.md`](../agents/README.md).
