---
name: feature
description: >-
  Use when the owner asks for a new capability, model, endpoint or screen, or
  anything likely to take more than one PR: runs the planner to write the feature
  doc, asks the owner its questions, and stops for approval before any code.
---

# Plan a feature

Process: `docs/PROCESS.md` → Feature.

1. **Run the planner agent** with the owner's request verbatim, plus any links
   or constraints from the conversation.
2. **If it classifies the change as Trivial or Small**, show its short plan and
   continue as that class — no feature doc.
3. **If Architectural**, continue with `/adr` using the planner's draft.
4. **Review the draft** `docs/features/<slug>.md` yourself: it follows
   `docs/templates/feature.md`, fits PRODUCT.md and ADR-0019, and every slice has
   tests.
5. **Ask the owner** the planner's questions with **AskUserQuestion** —
   recommended option first with a one-line reason; batch related questions.
   Include a final "Approve this plan?" question.
6. **Stop.** Do not write application code until the owner approves.
7. **On approval:** record the answers and date under _Decisions & open
   questions_, set Status to **Approved**, and list the slices as the build
   order (one branch and PR per slice, each shipped with `/ship`). Mention the
   feature in PRODUCT.md's Now section if it is starting.
8. **On rejection or changes:** update the doc and ask again.
