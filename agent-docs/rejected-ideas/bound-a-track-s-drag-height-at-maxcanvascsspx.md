---
name: bound-a-track-s-drag-height-at-maxcanvascsspx
description: Bound a track's drag height at `maxCanvasCssPx()`
area: rendering-and-displays
---

# Bound a track's drag height at `maxCanvasCssPx()`

declined 2026-08-25.
The blank it was opened for is fixed: past `MAX_CANVAS_DIM_PX` a display draws
at reduced resolution rather than asking for a viewport its target cannot hold
(ARCHITECTURAL_LIMITS.md §"A canvas past `MAX_CANVAS_DIM_PX` renders wrong,
not smaller"). What is left is a resolution falloff above ~4096 CSS px on a
retina panel and ~8192 at dpr 1, which is invisible in practice. A clamp in
`TrackHeightMixin` is the wrong shape anyway — MAF scrolls its overflow into a
viewport and the multi-row painting divides the cap across rows — so the
honest version is a per-display-type decision repeated across displays, for a
handle that stops at a different place on every monitor. Reopen only if the
falloff is reported.
