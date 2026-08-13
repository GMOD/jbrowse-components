---
name: interaction-perf
description: Measured: interaction is main-thread React re-render bound, and the per-frame churn is the LGV coordinate ruler creating ~144 tick divs per zoom, not the alignments overlays. Read before optimizing the wrong component.
---

# Interaction perf: which components re-render per frame

Measurements, not a proposal — the one open action they point at (pooling the
ruler's tick `<div>`s) is in [TODO.md](../TODO.md).

### Where this leaves the perf story (all measured)

- Interaction is main-thread-JS bound (frame time scales ~linearly with CPU
  throttle), not GPU and not MobX.
- The cost is React re-render + MUI/Emotion CSS-in-JS, and CSS-in-JS is a
  per-render tax — so it's really the "too many components re-render per frame"
  problem wearing a styling-cost hat.
- tss-react is already optimized — no win there.
- The tooltip wasn't the culprit. The remaining ~21ms/frame at 4× is the broader
  set of components that re-render on `bpPerPx`/`offsetPx` — the
  coverage/label/arc overlays and the LGV chrome.

### Honest next step

The only thing that reduces that per-frame cost is cutting the number of
components that re-render each zoom frame. Pinning down which ones needs a
React-render-level measurement (React DevTools profiler or render counters), not
a CPU flame graph — that's the right tool for "who re-rendered and why."

**Measured culprit (2026-07-11): the LGV coordinate ruler, not the alignments overlays.** A `MutationObserver` attributing every DOM mutation during a 5× zoom to its nearest `data-testid` subtree found ~2056 mutations dominated by `rubberband_controls` (the ScaleBar): 719 structural node add/remove + 439 style-attr, vs **2 of 2056** in the alignments overlays. The alignments display overlays are already zoom-invariant (`highlightBoxes` short-circuits to `[]` when nothing hovered; `renderSections`/`sections`/`groupLaidOutMap` read only vertical layout, never `offsetPx`/`bpPerPx`; sashimi/bezier default-off) — **do not chase them.** `VisibleLabelsOverlay` is a canvas, so it contributes no DOM churn.

The churn is `ScalebarCoordinateLabels` (`plugins/linear-genome-view/.../ScalebarCoordinateLabels.tsx`): it creates/destroys ~144 tick `<div>` nodes per zoom click. Its `key`-by-base reuse works for *pan* (same bases scroll across) but not *zoom* — the scale changes, so the tick set + keys change every frame, forcing React to tear down + rebuild the whole tick list, each new node paying the emotion/tss `tickLabel` styling cost. Fix, lowest-risk first: **pool the tick `<div>`s** (fixed pool, reposition+relabel, no add/remove) → kills the 719 structural churn, keeps accessible DOM text; or a **canvas ruler** (bigger win, loses selectable text); or **coarsen ticks off `coarseBpPerPx`** during the zoom spring, snap exact on settle. Repro tool: `website/scripts/measure-zoom-churn.ts` (throwaway) + `~/src/jb2bench/scripts/interaction-profile.ts <url> <label> [pan|scroll|zoom|both]`, `THROTTLE=n`.

Also, per-mousemove: `AlignmentsDisplayComponent` `setMouseCoord` on every `onMouseMove` re-runs the top observer; children are `observer`-memoized so blast radius is mostly the tooltip — confirm no inline object/array prop defeats a child's memo.
