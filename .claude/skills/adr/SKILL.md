---
name: adr
description: >-
  Use when a change is Architectural — new infrastructure, superseding an ADR,
  diverging from the reference template, or a major dependency change: drafts a
  Proposed ADR, updates the index, and asks the owner to accept it.
---

# Record an architectural decision

Conventions: `docs/adr/README.md`. Process: `docs/PROCESS.md` → Architectural.

1. **Number:** the highest `docs/adr/NNNN-*.md` plus one, zero-padded.
2. **Draft** `docs/adr/NNNN-<kebab-title>.md` from `docs/adr/_template.md` (or the
   planner's draft): Status **Proposed**, today's date, Deciders "Project owner
   (drafted with Claude)". Context, Decision ("We will …"), at least two real
   alternatives, and consequences including new debt. Check it against
   PRODUCT.md and ADR-0019.
3. **Supersede, never edit:** if it replaces an accepted ADR, say so in the new
   ADR; the old one's Status changes to "Superseded by ADR-NNNN" only on
   acceptance.
4. **Index:** add a row to the table in `docs/adr/README.md` (Status Proposed).
5. **Ask the owner** with AskUserQuestion: accept (recommended if the
   alternatives were weighed), accept with changes, or reject — one line on the
   key trade-off.
6. **On acceptance:** set Status **Accepted** in the ADR and the index; update the
   superseded ADR's Status; add terms the decision retires to `STALE_TERMS` in
   `scripts/check-docs.mjs`; add a `docs/DECISIONS.md` entry if it reverses a
   logged decision, and a `docs/TECH_DEBT.md` row for debt it creates; list it in
   CLAUDE.md only if CLAUDE.md names it.
7. **On rejection:** keep the file with Status "Rejected" and the reason, or
   delete the draft if it never left the branch — ask the owner which.
