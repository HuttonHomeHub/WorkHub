# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets),
which versions WorkHub's packages and writes their changelogs.

Add a changeset only when the running app changes (`apps/api`, `apps/web` or
`packages/types`) — not for docs, CI or tooling:

```bash
pnpm changeset
```

Pick the affected packages and the bump, write a summary for the owner who will
deploy it, and commit the generated file with the change.

When to add one, which bump to choose, why `config.json` keeps
`privatePackages` and the `fixed` group, and how the Version Packages PR becomes
a release and images: [`docs/RELEASING.md`](../docs/RELEASING.md).
