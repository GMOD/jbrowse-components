---
name: overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes
description: an `overlay` label reserves nothing by design and the box shrinks faster than the label does, so the spill past the bottom grows from 1px in normal mode to 4.15px in superCompact, where the label more than covers the transcript under it — a bug or the contract, and nobody has said which
---

# `overlay` subfeature labels swallow the row below them in compact modes

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Reserving a row stops overlay being free, which is the
only reason to pick it over `below` — so the call is what overlay MEANS, not a
fix.

An `overlay` subfeature label puts its top at the box's top (`relativeY =
-featureHeight` in `createTranscriptFloatingLabel`) and reserves nothing, by
design — that is what "overlay" means. The label is drawn at
`labelFontSize(displayMode)` while the box is `featureHeight ×
HEIGHT_MULTIPLIERS`, and those two shrink on different curves, so the spill past
the bottom of the box grows as the mode gets denser:

| mode | box | label | spill |
| --- | --- | --- | --- |
| normal | 10px | 11px | 1px |
| compact | 6px | 8.25px | 2.25px |
| superCompact | 3px | 7.15px | 4.15px |

In superCompact the label more than covers the transcript under it. Measured
2026-08-11 while evaluating overlay as a compaction for `below` (it was rejected
for this reason — see REJECTED_IDEAS.md).

**The call to make: is this a bug or the contract?** Reserving a row for overlay
in compact modes is now cheap — the `labelRowsAbove` channel exists and the main
thread already spends it (`FeatureLayout.labelRowsAbove`) — but it stops overlay
being free, which is the only reason to pick it over `below`. The alternative is
to say overlay is a normal-mode affordance and document it. Not the
implementer's call, hence here rather than in the small-items section.
