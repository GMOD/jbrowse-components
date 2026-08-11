---
name: handoff-alignments-colour-parity
description: Live state of the alignments colour-parity thread — what landed, what is verified by eye versus only by test, and the repo-state gotchas found on the way. The durable knowledge is filed elsewhere and linked from here.
---

# Handoff: alignments colour parity

**Started** as a figure-review round (fix the `bad` entries in
`website/scripts/screenshot-review.json`). One review note — "there are red
arcs, but shouldnt the read pairs that are associated with those arcs also be
colored red" — turned out to be a class of bug rather than a figure setting, and
the thread became that.

Everything durable is filed. This file holds only what is still live.

## Where the knowledge went

- **How the colour paths work, and why they derive rather than reconcile** →
  [reference/ALIGNMENTS_COLOR_PARITY.md](../reference/ALIGNMENTS_COLOR_PARITY.md)
- **The capability given up with the span heuristic** →
  [reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md), first entry
  under Rendering and displays
- **The three open items, in order** → [TODO.md](../TODO.md)
- **What was done and when** → `git log`

## State

`screenshot-review.json`: 440 good, 6 answered, **0 bad**. The two entries that
survived four rounds (`gallery/inverted_duplication`,
`cancer_sv/derivative_*`) are answered with the reasoning in their notes;
`tcga/mutations_tp53_recurrence` was deleted on review and its spec carries a
note saying why, so it is not re-proposed.

`plugins/alignments`: 154 suites, 1583 tests green. Typecheck and lint clean.

The colour chain, oldest first: `3626810a1d` (the legend fold asserting an
untested claim) → `e0e97e6b64` (arcs colour by TLEN) → `1677f3c4ac` (figures) →
`9df379f8b7` (overlay palettes follow the theme) → `e71dc174e2` (one table per
overlay, colour derived) → `904c8ea74e` (drop the duplicate marker palette, pin
the last split) → `4b167421f5` (file it).

## Verified by eye, versus only by test

Worth separating, because the whole thread is about invariants that held in
tests and not in pictures:

- **Looked at**: the read/arc colour agreement, the super-compact cancer_sv
  lanes, the TCGA recurrence rows, the light-mode arc palette after the TLEN
  change (red arcs survive where TLEN genuinely says long).
- **Not looked at**: **dark mode.** The palette fix is proven over the tables
  and has never been rendered. This is the first TODO item for that reason.

## Repo-state gotchas found on the way

Neither is caused by this thread; both cost time.

- **`pnpm autogen` dies in a fresh worktree.** The config-schema-manifest
  generator resolves `@jbrowse/core/*` through the package `exports` map, whose
  ESM condition points into `packages/core/esm/` — which a fresh worktree has
  never built. It fails on `@jbrowse/core/ui/legendSpec`. Worse, it also makes
  autogen's own `exports`-map edit untrustworthy in that state, so do not commit
  that file's diff from a worktree run. The doc generators before it do run;
  `node website/scripts/api-docs/generate.ts` alone is enough for model docs.
- **Some figures predate a concurrent arc-shape fix.** `43f32c2a0a`
  (`fix(alignments): far arcs were hulls, not curves, past the first chord`)
  changed `arc.slang` mid-thread without regenerating figures. The six captured
  in `1677f3c4ac` were built before it. Not wrong, just short one unrelated fix;
  the weekly sweep covers it.
