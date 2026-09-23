# Feature docs

One Markdown file per feature, written before it is built and kept as living
documentation afterwards. The process around them is in
[PROCESS.md](../PROCESS.md#feature).

- **Naming:** `<slug>.md`, kebab-case, matching the branch slugs (e.g.
  `time-entries.md` for `feat/time-entries-list`).
- **Template:** [templates/feature.md](../templates/feature.md). The **planner**
  agent (`/feature`) writes the first draft.
- **Lifecycle:**
  1. **Draft** — written by the planner; open questions listed.
  2. **Approved** — the owner has answered the questions; decisions recorded.
  3. **In progress** — slices landing; _As-built notes_ updated with each PR.
  4. **Shipped** — the doc describes what exists. It stays here and is updated
     whenever the feature changes; the capability is listed in the
     [PRODUCT.md](../PRODUCT.md#feature-inventory) inventory.
- A feature that is dropped keeps its doc with a note saying why, rather than
  being deleted.

## Index

| Feature                           | Status  | Summary                                                             |
| --------------------------------- | ------- | ------------------------------------------------------------------- |
| [Hours tracker](hours-tracker.md) | Shipped | The first tool: daily hours, weekly flexi, TOIL, overtime and leave |
