---
name: a-ci-guard-for-screenshot-spec-figure-staleness
description: A CI guard for screenshot spec ↔ figure staleness
area: tooling-tests-and-docs
---

# A CI guard for screenshot spec ↔ figure staleness

proposed as
`ideas/website-screenshot-staleness.md` and closed 2026-08-19, because the
workflow it was written against no longer exists. The proposal (hash a spec's
render inputs, record the hash beside the committed PNG, fail CI when they
drift) was written on 2026-07-08, the same day as the batch it cites —
`6f0392a387`, 8 specs fixed and 0 PNGs committed, all 8 re-flagged against the
old images. The weekly sweep landed 2026-08-05 and the S3 figure store
2026-08-06; nobody re-costed the idea against either, and the move out of
`OTHER_IDEAS.md` on 2026-08-13 carried the July text unchanged.

Specs and figures now reconcile the same day. Taking each `specs/*.ts` file's
last commit against the newest `figures.lock` change among the figures it
declares: 17 of the 26 files that own figures match to the day, and the widest
gap is 3 days (`ui.ts`, 2026-08-19 against 2026-08-16). A per-commit check
would still have fired ~130 times in the week of 2026-08-10, because specs land
in one- and two-file commits while figures are pushed in batches — and its red
clears only with a jbrowse-web build and a render against jbrowse.org, which is
the cost the proposal itself names as the reason regeneration gets skipped.
That is the trap `.github/workflows/figures.yml` documents for gates built on
this corpus.

The bigger reason is that spec edits are not what makes a published figure
stale. The 2026-08-17 sweep moved 127 of 329 figures past the 0.5% pixel gate
from one week of app changes, with every author's own regenerations already
committed. The sweep answers that question weekly, with before/after images;
the guard would have answered a smaller one.

**What would earn it**: a review-time pointer, not a gate. `figures.lock`
tracks one line per figure, so a spec-object hash as a fifth column — written
by `figures:push`, which runs exactly when someone adopts fresh bytes — would
make "this figure's spec changed after its bytes were rendered" a check with no
browser and no network. Build it if the review loop starts re-flagging fixed
figures again; the sweep, and same-day regeneration, are what keep it from
happening now.
