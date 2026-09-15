# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets),
which we use to version packages and generate `CHANGELOG.md` entries in step with
[Semantic Versioning](https://semver.org).

## Adding a changeset

When your change is user-visible (a feature, fix, or breaking change), run:

```bash
pnpm changeset
```

Select the affected packages, choose the bump type (`patch` / `minor` / `major`),
and write a short, user-facing summary. Commit the generated markdown file in this
directory alongside your code change.

## Bump types

| Type    | When to use                                    | SemVer |
| ------- | ---------------------------------------------- | ------ |
| `patch` | Bug fixes, internal changes with no API impact | 0.0.x  |
| `minor` | Backwards-compatible new features              | 0.x.0  |
| `major` | Breaking changes to a public API or contract   | x.0.0  |

When changesets land on `main`, the `release` GitHub Actions workflow opens or
updates a "Version Packages" PR; merging that PR cuts the release. See
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Why `config.json` looks the way it does

- `privatePackages: { version: true, tag: true }` — every workspace package is
  `private`, and Changesets 3 would otherwise neither version nor tag them.
- `fixed: [["@repo/api", "@repo/web", "@repo/types"]]` — the apps share one
  version, so the release tags (`@repo/api@X.Y.Z`, `@repo/web@X.Y.Z`) and the
  images built from them always match one `IMAGE_TAG`.
