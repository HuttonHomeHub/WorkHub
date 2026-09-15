---
name: release
description: >-
  Use only when the owner asks to release or deploy: runs the pre-release
  checklist, confirms with the owner, merges the Version Packages PR, watches the
  Release workflow and image publishing, and reports the IMAGE_TAG and upgrade
  steps.
---

# Cut a release

Reference: `docs/DEPLOYMENT.md`. Never start this unprompted.

1. **Find the release PR:** `gh pr list --search "chore(release): version packages in:title"`.
   If none exists, there are no pending changesets — say so and stop.
2. **Pre-release checklist** — report each item:
   - CI green on `main` (`gh run list --branch main --workflow CI --limit 1`).
   - The release PR has CI: GitHub runs none for PRs opened by `GITHUB_TOKEN`,
     so ask the owner to close and reopen it (or push an empty
     `chore(release): run ci` commit to its branch), then wait for green.
   - Pending changesets and the proposed `CHANGELOG.md` entries read correctly.
   - Migrations since the last release reviewed; any destructive migration has a
     rollback note — and, once backups exist, a **fresh backup taken** before
     deploying.
   - Relevant docs updated; no open CodeQL high-severity alerts.
3. **Confirm with the owner** via AskUserQuestion: "Merge the Version Packages PR
   to release X.Y.Z?" — options: release now (recommended when the checklist is
   clean), wait. Stop unless they choose to release.
4. **Merge** the release PR: `gh pr merge <n> --squash`.
5. **Watch** the Release workflow on `main` (`gh run watch`): the `release` job
   tags `@repo/api@X.Y.Z` and `@repo/web@X.Y.Z`, then the `publish-images` job
   pushes both images to GHCR. Report failures with the log excerpt.
6. **Report:** the version, `IMAGE_TAG=X.Y.Z` (no `v`), the image names, and the
   upgrade steps from `docs/DEPLOYMENT.md` — set `IMAGE_TAG` in
   `.env.production`, then `docker compose -f docker-compose.prod.yml --env-file .env.production pull`
   and `up -d`; rollback is the previous tag (restore the backup first if a
   migration was destructive).
