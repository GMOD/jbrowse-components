---
name: a-wiggle-layer-earns-its-place-with-a-window-stat
description: Wiggle layers (bars under a line, `extent` as an error band) and a `window` stat (rolling mean) are one design question, since a layer alone says little. Blocked by one plot family per region and the origin-flipping nesting order. Read before proposing layers, transforms or smoothing on the quantitative display.
---

# A wiggle layer earns its place with a window stat

Layering alone (`extent` drawn as an error band, bar + line) earns little on a
wiggle track. With a `window` stat it tells a story: raw bars under a smoothed
trend, as a phyloP or a CNV-cohort track wants.

```js
// a sketch, not a spelling
layers: [
  { mark: 'bar' },
  { mark: 'line', transform: [{ window: { op: 'mean', frame: 2000 } }] },
]
```

## What stands in the way

- **One plot family per region.** `wiggleParams` reads the plot type off
  `sources[0]` (`plugins/wiggle/src/shared/wiggleMarks.ts`), and each family
  has its own GPU pass structure. A layer list needs a region to hold two.
- **The nesting order flips at the origin.** The positive side paints
  max→min, the negative side min→max (`stackSides` in
  `shared/wiggleLayers.ts`). A flat layer list cannot say that, which is
  ADR-227's objection. A layer item that is a whole one-plot spec keeps
  `stackSides` inside it and answers the objection.
- **No `transform` slot.** `featureTransforms` is core's mark-display step;
  a `window` stat is new machinery over `RawFeatureArrays`, a 1-D rolling
  mean that is cheap in the worker. `data.resolution` is points per pixel,
  not a bin width (ADR-238 kept it), so the frame needs its own unit.
- It reopens ADR-216's rejected `marks[]` alternative at the spelling level.

## The call

Whether quantitative tracks get a second layer at all. Review it on real
tracks (phyloP, a CNV cohort, bedMethyl), not on volvox. Already declined
and not reopened by this: an independent y per mark (ADR-141), size from a
field (ADR-216), render-core marks as the renderer (ADR-227).
