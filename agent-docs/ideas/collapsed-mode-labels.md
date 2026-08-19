---
name: collapsed-mode-labels
description: Making `displayMode: 'collapsed'` keep its feature names, which is what would let a labelled lane take one row — the solver-not-a-row constraint, the stability-under-pan constraint, and the four consumers that have to agree on the answer.
---

# Collapsed mode with labels

`collapsed` packs every feature onto one row, which is the largest vertical
saving a linear feature display has, and it **hides every name** to do it —
`showLabels` in `LinearBasicDisplay/baseModel.ts` returns false outright in that
mode. So the saving is available to exactly the lanes whose content is their
glyphs, and unavailable to the ones whose content is their labels.

That is the trade a figure keeps running into. `cancer_sv/derivative_synteny`'s
"Where each segment came from" lane is the worked example: four features whose
whole payload is the interval each names (`chr3:25,326,821-25,359,568 (32.7 kb)`
is the provenance of the allele's largest segment), so collapsing it deletes the
lane rather than compacting it. `compact` is what those lanes take instead — it
scales the glyph bodies and the label font and keeps the labels, at the cost of
still spending a row per overlapping feature.

## Why it is a project and not a flag

**Labels have to be placed against a solver rather than against a row.** Today a
name is drawn at its feature's own row, so placement is free: the packer already
decided nothing else is there. On one row every name in the window competes for
one strip of space, and the answer is a global assignment — offsets, leader
lines, or a gutter beside the lane — computed over the visible set rather than
per feature. That is the force-directed placement reviewers keep naming, and
nothing in a linear display does it; the graph view's force layout is a
different pane in a different plugin, over nodes that have no genomic x.

**And the placement has to be stable under pan, or it flickers.** A solver rerun
each frame over a slightly different visible set is free to return a different
assignment for the features that did not move, so labels jump on scroll — the
failure that makes an unstable version worse than no labels. Whatever the
solution is, a feature's label position has to be a function of the feature and
its neighbours in genomic space, not of what happens to be on screen.

## Where it would land

`showLabels` is deliberately one gate feeding **four** consumers — layout, hit
testing, the DOM overlay and SVG export — so that reserved space, drawn text and
click targets cannot disagree. A collapsed-with-labels mode has to give all four
the same placement, which means the solver output is layout data, not a paint-time
decision. The main thread's `packRef` (`LinearBasicDisplay/layout.ts`) is where it
belongs for the same reason the compact subfeature-label reservation does — the
mode and `labelFontPx` are known there and the worker is deliberately
mode-agnostic. See
[REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md)'s canvas-glyph entry for
that boundary and [display-height-redesign](display-height-redesign.md) for the
height side of the same problem.

## What not to re-propose

Drawing the names at the row anyway and letting them overlap: that is what
`showLabels` being a single gate prevents, and the overlap is worst in exactly
the dense case collapsed mode is for.
