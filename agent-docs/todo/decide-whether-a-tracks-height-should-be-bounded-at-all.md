---
name: decide-whether-a-tracks-height-should-be-bounded-at-all
description: the blank is fixed; what is left is whether the drag should stop, and per display
metadata:
  area: GPU, limits
  category: ready
---

# Decide whether a track's height should be bounded at all

**The blank this entry used to describe is fixed** (2026-08-22): past
`MAX_CANVAS_DIM_PX` a display now draws at reduced resolution instead of asking
for a viewport its target cannot hold, because `syncCanvasSize` reports the scale
each axis actually got and every rect derives from that.
[reference/ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md) §"A canvas
past `MAX_CANVAS_DIM_PX` renders wrong, not smaller" carries the mechanism and
the verification.

What is left is a judgement nobody has made: **should a drag be bounded by
`maxCanvasCssPx()` anyway?** `TrackHeightMixin`'s `setHeight` / `resizeHeight`
clamp at `MIN_DISPLAY_HEIGHT` and at no maximum, so a track can still be dragged
to any height — it just renders correctly now, at a resolution that falls off
above ~4096 CSS px on a retina panel and ~8192 at dpr 1. Arguments both ways:

- **Bound it.** The resolution falloff is invisible in practice but real, and a
  track taller than two screens is not a thing anyone reads — the handle simply
  stopping is honest and needs no message.
- **Leave it.** The cap is per-axis and dpr-dependent, so the same drag stops at
  different places on different monitors, which is its own confusion. And a flat
  clamp in the shared mixin is the wrong shape for the displays that already
  bound themselves differently: MAF scrolls its overflow into a viewport, and the
  multi-row painting divides the cap across rows.

Not urgent either way now that the failure is graceful. Whoever takes it should
decide per display type, not in `TrackHeightMixin`.
