---
name: the-device-pixel-ratio-uniform-has-three-spellings
description: A shader's `devicePixelRatio` uniform is `getDpr()` in some displays and `clip.scaleY` in others; they differ only on a capped canvas, where no single scalar is one output pixel on both axes. Marks take a scale per axis.
---

# The `devicePixelRatio` uniform has three spellings

## Ruling

A mark that ramps in both axes takes a scale per axis (`clip.scaleX`,
`clip.scaleY`), and `barMark`, which ramps only in y, takes `scaleY`. On a
capped canvas no single scalar is right either way. This amends
[ADR-098](../../architecture-decision-records/adr-098-one-ramp-one-unit-and-the-build-checks-it.md)'s
Decision, which names `getDpr()`; uncapped, both scales equal it.

What a display writes into a shader's `devicePixelRatio` uniform, which sizes
antialias ramps, pads and stroke floors (`aaPx`, `flooredStrokeWidthPx`):

| Spelling | Writers |
| --- | --- |
| `getDpr()` | wiggle, synteny, features, dotplot, alignments, and render-core's bar, line, point, link and connector marks |
| `clip.scaleY` | chords, rings, the variant cell pass |
| `min(clip.scaleX, clip.scaleY)` | proposed for the five render-core marks and declined |

[ADR-098](../../architecture-decision-records/adr-098-one-ramp-one-unit-and-the-build-checks-it.md)'s
Decision names `getDpr()`, and `packages/render-core/CLAUDE.md` says to take the
pixel ratio from it.

**They differ only on a capped canvas.** Uncapped, the reported scale is the
dpr on both axes ([ARCHITECTURAL_LIMITS.md](../../reference/ARCHITECTURAL_LIMITS.md)).
A backing store held under `MAX_CANVAS_DIM_PX` (8192 device px) on one axis, or
a WebGL drawing buffer Chrome shrank, reports a smaller scale on that axis
only.

**On such a canvas no single scalar is right for both axes.** At dpr 2, a link
track dragged to 20000 CSS px tall has `scaleX` 2 and `scaleY` 8192 / 20000 =
0.41:

- `getDpr()` gives a 0.5 CSS px ramp: one device px across x, a fifth of one
  down y.
- `scaleY` or the `min` gives a 2.4 CSS px ramp and a 3.7 CSS px stroke floor:
  one device px down y, about five across x. Near-vertical arc legs go from
  1.5 to about 7 device px wide.

`barMark` ramps only in y, so for it alone `scaleY` is the exact answer.

