---
name: arc-foot-bound-and-the-y-offset-band
description: The track-y-offset label-box research is done and refutes its own idea doc's recommended fix, so that thread waits on an approach decision, not on more digging. The breakend-foot region bound that used to share this file landed.
---

# The track y-offset label band

Research from the 2026-09-03 pass over `ideas/`. The breakend-foot region
bound that shared this file landed (see `git log -- plugins/alignments/src/features/arcs/crossRegionFeetBound.test.ts`).

## Research done, refutes its own idea doc

For
[`ideas/track-y-offset-cannot-see-the-label-box.md`](../ideas/track-y-offset-cannot-see-the-label-box.md).
`getTrackYOffset` (`LinearGenomeView/model.ts:1093`) sums
`trackHeight(t) + trackChromeHeight`, and `trackChromeHeight` (`:1000`) is the
gap, resize handle and borders — everything `TrackContainer` lays out except the
label. **Fold these five findings into that idea doc when the thread is taken,
and delete this file.**

- **The doc's own "cheapest" option is a trap.** It proposes returning
  `undefined` when labels show. The signature is _already_ `number | undefined`,
  and the single call site reads
  `yOffsetsOverride?.[level] ?? domYOffsets?.[level] ?? viewTop + (view.getTrackYOffset(trackId) ?? 0)`
  (`BreakpointSplitView/model.ts:466`). The `?? 0` swallows it and `viewTop + 0`
  means "this body starts at the top of the row" — exactly the failure
  `BreakpointSplitViewOverlay.tsx:11-15` documents as its reason for measuring
  `undefined` rather than `0`. Making it honest means changing
  `OverlayLevel.yOffset` to nullable, `computeOverlayY` and its six tests, the
  documented clamp invariant, and every overlay kind's drop path — larger than
  the fix it was meant to avoid.
- **The deficit is inclusive, so both docstrings are off by one.** `y` starts at
  the first Paper's content top, and each track's own label sits in flow above
  its rendering container inside its Paper — so the shortfall is one band per
  labelled track **at or above** the requested one, `(i+1) × band`. The getter's
  docstring and the idea doc both say "above this one".
- **`prefersOffset` is not what turns offset labels on.** `'offset'` is the
  config default for every track (`plugin-linear-genome-view/src/index.ts:45`);
  `prefersOffset` only overrides when the user has chosen `'overlapping'`. The
  inexact case is the default for all tracks, not a per-display quirk.
- **The band is not the label's height.** `trackLabelOffset` is `inline-block`
  with `marginBottom: 8` (`TrackContainer.tsx:66`), so the push is a line box
  and `label.height + 8` is an approximation. The exact quantity is
  `renderingContainer.top − paper.top`, the same delta `useDomTrackYOffsets`
  already takes one level up.
- **Fixing `getTrackYOffset` fixes level 0 only.** `viewTop` accumulates
  `view.height` (`model.ts:1069` → `trackHeightsWithChrome` `:1062`), which
  carries the identical omission, so a multi-row fallback stays short by every
  band in the rows above unless `height` is treated too. `height`'s other
  consumer is only a lazy-mount scroll placeholder
  (`app-core/src/ui/App/ViewContainer.tsx:41`), which tolerates being wrong.

**Where the wrong number is actually reached** — `domYOffsets` is undefined, and
the arithmetic used, in four windows: the frames before the first
`requestAnimationFrame` measurement lands (the state starts `{}`); a
**minimized** track, which mounts no rendering-container ref but does still
render its label; a mid-remount frame (display-type swap, reorder, pin toggle);
and when the overlay's SVG ref is null.

**Nothing pins any of it.** No test references `getTrackYOffset`,
`trackChromeHeight`, `trackLeadingChrome`, `trackTrailingChrome` or
`domYOffsets`. The natural home for new tests is
`BreakpointSplitView/svgcomponents/util.test.ts`, which already asserts the
label band for the **export** path — "the first body starts below its own label
band" — the exact invariant `getTrackYOffset` violates.

**Helpers to reuse rather than reinvent.** `useChromeHeightVar`
(`core/src/util/hooks.ts:463`) is this exact pattern, `getBoundingClientRect()`
not `offsetHeight`, `ResizeObserver`, cleanup, and its docstring carries the
measured observer cost — but it publishes to a CSS custom property, which a
model getter cannot read. `useWidthSetter` (`hooks.ts:94`) is the precedent for
pushing a measurement into MST, including the `requestAnimationFrame` guard that
dodges the ResizeObserver-loop warning. `trackRefs` (`model.ts:538`, written by
a callback ref in `TrackRenderingContainer.tsx:121`) is the existing per-track
DOM registry — but a plain object mutated in place, so it is **not**
MobX-reactive and a sibling record written the same way would be invisible to
observers.

**The decision this waits on** is which fix to take, and it is a real one:
measuring the band into model state is the only option that makes the number
right, and it costs a per-label observer plus an answer to the reactivity
question above; taking the label out of flow ends the whole class of drift and is
a visual call on every labelled track; the doc's third option should be struck.
A cheap honest step, if one is wanted first, is the naming half alone — the
getter's name is the thing lying.
