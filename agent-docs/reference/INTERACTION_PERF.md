---
name: interaction-perf
description: 'Measured: interaction is main-thread React re-render bound, the per-frame churn is the LGV coordinate ruler creating ~144 tick divs per zoom rather than the alignments overlays, and the p99 during a multi-track pan is periodic on the 500 ms coarse tick — with the two traps that make that period look absent (testing it against the wall clock) and its size look meaningful (a loaded box, where the profile goes 83% program). Read before optimizing the wrong component, or before quoting a frame spike measured on this machine.'
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

## The p99 during a pan is periodic, and the period is the only part you can measure on a loaded box

**Measured 2026-08-14**, six BAM tracks at `chr22_mask:124000-143000`, 240
rAF-paced frames x 3 passes, one build. `jb2bench/scripts/render/multibam.ts` now
persists the raw per-frame gaps for this (`rows[].gaps`, one array per pass); its
summary columns cannot answer "when", and every question here is about when.

Each pass carries exactly **two** events over 100 ms and almost nothing else, and
the interval between them is **79, 79, 80 frames** across the three passes — about
500 ms at this build's ~6.3 ms frame. So the coarse-update tick that
`coverageStats` reads (`coarseDynamicBlocks`, ~2x/sec) does line up with the
over-budget frames, which is what a per-track herd on one tick would look like.

Three things about that measurement are worth more than the number:

- **Test the period on frame index, or on wall time with the stalls' own duration
  removed — never on the raw wall clock.** A spike longer than the period
  displaces every later frame, so a genuinely periodic trigger cannot stay on a
  wall-clock grid once the first spike exceeds 500 ms. Tested that way the same
  data reads "scattered" at mod 500, mod 250 and mod 1000, and the hypothesis
  looks refuted when it is not.
- **No refetch is involved.** Every RPC worker profiled **100% idle** through the
  gesture, so the bench's "this is re-render cost, not network" claim holds at six
  tracks, and the tick's cost is main-thread or browser-side.
- **The SIZE is the machine.** The two events were ~6.4 s and 0.4-1.7 s, and the
  main-thread profile of that same gesture is **82.8% `(program)`** with the
  workers idle — i.e. the renderer process was not executing JS. At load 16-22 on
  a box shared with ~10 agent sessions that is descheduling, so the period is
  JBrowse's and the magnitude is not. An earlier sweep of the same gesture called
  these 46-55 ms; neither figure is a property of the code.

**What the tick actually costs is not the stats computation.**
`computeVisibleCoverageStats` is a tight typed-array loop over the visible bp span
— ~19k entries per track here, tens of microseconds — so memoizing it to skip the
work saves nothing worth measuring. The cost is the invalidation it publishes:
`coverageStats` -> `coverageDomain` -> `coverageDepthDomain` ->
`renderState.coverageMinDepth`/`MaxDepth`, and `renderState` is tier 5, a full
canvas repaint, per open track, on one tick. Both of the first two build a fresh
object every evaluation, so the chain runs and the repaint happens **even when
every value is unchanged**.

So the change worth measuring is a **value-equality memo on `coverageStats`** —
return the previous object when the stats are equal, and MobX's default `===`
comparer stops the chain there. What decides whether it pays is a count nobody has
taken: how often consecutive coarse ticks during a pan produce equal stats. The
coarse blocks do move, which is why they update at all, so this is not obviously
often. Take that count before writing the memo.
