---
name: release
description: >-
  Use only when the owner asks to release or deploy: runs the pre-release
  checklist, confirms with the owner, merges the Version Packages PR, watches the
  Release workflow and image publishing, and reports the IMAGE_TAG and upgrade
  steps.
---

# Cut a release

Reference: `docs/RELEASING.md` (release mechanics and checklist) and
`docs/OPERATIONS.md` (the server upgrade). Never start this unprompted.

1. **Find the release PR:** `gh pr list --search "chore(release): version packages in:title"`.
   If none exists, there are no pending changesets — say so and stop.
2. **Pre-release checklist** — report each item:
   - CI green on `main` (`gh run list --branch main --workflow CI --limit 1`).
   - The release PR has CI: GitHub runs none for PRs opened by `GITHUB_TOKEN`,
     so ask the owner to close and reopen it (or push an empty
     `chore(release): run ci` commit to its branch), then wait for green.
   - The proposed entries in `apps/api/CHANGELOG.md` and `apps/web/CHANGELOG.md`
     read correctly for the owner, call out anything to do on the server, and
     the bump matches `docs/RELEASING.md`.
   - Migrations since the last release reviewed against `docs/DATABASE.md` →
     Migration safety; the owner knows to **take a backup before upgrading**
     (required when a migration is included).
   - Relevant docs updated; no open CodeQL high-severity alerts.
3. **Confirm with the owner** via AskUserQuestion: "Merge the Version Packages PR
   to release X.Y.Z?" — options: release now (recommended when the checklist is
   clean), wait. Stop unless they choose to release.
4. **Merge** the release PR: `gh pr merge <n> --squash`.
5. **Watch** the Release workflow on `main` (`gh run watch`): the `release` job
   tags `@repo/api@X.Y.Z` and `@repo/web@X.Y.Z`, then the `publish-images` job
   pushes both images to GHCR. Report failures with the log excerpt.
6. **Report:** the version, `IMAGE_TAG=X.Y.Z` (no `v`), the image names, whether
   the release contains a migration or a compose/env change, and the upgrade
   steps from `docs/OPERATIONS.md` → Routine upgrade — back up, set `IMAGE_TAG`
   in `.env.production`, `pull`, `up -d`, check `migrate` exited 0, health
   check. Rollback is the previous tag, restoring the pre-upgrade dump first if a
   migration ran.
