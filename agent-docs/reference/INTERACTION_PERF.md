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

**Everything on this page was measured on ONE track, and the tax scales per
track**: each one mounts its own overlay and chrome subtree, so a six-track
session pays it six times. Since `computeVisibleLabels` stopped deciding its walk
from the data's longest feature, this is the entire residual —
`jb2bench/scripts/render/multibam.ts` sweeps the track count with region, zoom,
viewport, gesture and frame count held fixed. The two directions parked at one
track are the two to take at N: reposition overlays by CSS transform during a
gesture, and hoist static styles out of the per-frame render.

**It is blocked on a quiet machine, and demonstrably so** — see the periodicity
section below, where the same gesture profiles at 83% `(program)` with every
worker idle. Attribution is worthless in that state and the inflation is not
uniform across frames.

**Measured culprit (2026-07-11): the LGV coordinate ruler, not the alignments overlays.** A `MutationObserver` attributing every DOM mutation during a 5× zoom to its nearest `data-testid` subtree found ~2056 mutations dominated by `rubberband_controls` (the ScaleBar): 719 structural node add/remove + 439 style-attr, vs **2 of 2056** in the alignments overlays. The alignments display overlays are already zoom-invariant (`highlightBoxes` short-circuits to `[]` when nothing hovered; `renderSections`/`sections`/`groupLaidOutMap` read only vertical layout, never `offsetPx`/`bpPerPx`; sashimi/bezier default-off) — **do not chase them.** `VisibleLabelsOverlay` is a canvas, so it contributes no DOM churn.

The churn was `ScalebarCoordinateLabels` (`plugins/linear-genome-view/.../ScalebarCoordinateLabels.tsx`): it created and destroyed ~144 tick `<div>` nodes per zoom click. Its `key`-by-base reuse works for *pan* and not *zoom*, which is the wrong way round — `scalebarLabels` is **unchanged** during a pan (the labels live in the staticBlocks frame, and only the container transform moves), so there was nothing there to save; a zoom moves the whole tick set, so every key changed and React rebuilt the list, each new node paying the emotion/tss `tickLabel` styling cost.

**Fixed 2026-08-15 by keying the list positionally**, which makes it a pool: same nodes, patched transform and text. Measured A/B on one machine and toolchain, two builds of the same commit differing only in the key:

<!-- BEGIN GENERATED MEASUREMENT scalebar-zoom-churn -->

| during a 5× zoom                     | identity keys | positional keys |
| ------------------------------------ | ------------: | --------------: |
| structural (mount/unmount), scalebar |           535 |         **248** |
| attribute patches, scalebar          |           323 |             499 |
| total mutations                      |         1,523 |           1,369 |

<!-- END GENERATED MEASUREMENT scalebar-zoom-churn -->

Read the trade, not the total: structural churn is the expensive class (each new node pays styling, layout and paint) and it halves, while the rise in attribute patches is the same work done the cheap way on nodes that survived.

**The residual 248 is the label *count* moving between frames.** Positional keys pool `min(oldCount, newCount)` nodes and still mount or unmount the difference, and the count shifts as label text changes width and `labelFitsInBlock` / `MIN_TICK_LABELS_PER_BLOCK` drop a different number of them. Closing it needs a genuinely fixed pool — a constant node count with the extras hidden — which is a bigger change than the key was, and worth roughly this remainder. The other two options are unchanged: a **canvas ruler** (bigger win, loses selectable text), or **coarsening ticks off `coarseBpPerPx`** during the zoom spring, snapping exact on settle.

Repro tool: `website/scripts/measure-zoom-churn.ts`, which needs `products/jbrowse-web/build` current — it serves the built bundle, so rebuild between arms or you measure the old one twice.

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

The obvious response is a **value-equality memo on `coverageStats`** — return the
previous object when the stats are equal, and MobX's default `===` comparer stops
the chain there. **Counted, and it has no case to fire in.** Six tracks, 360
frames, `jb2bench/scripts/render/coarsetick.probe.ts`: 4 coarse ticks over the
gesture, and at every one of them the stats **changed for all six displays — 0 of
24 equal**. Each display took exactly 5 distinct values: its initial one plus one
per tick.

That is not a near miss, and in hindsight it is what the tick *is*. The coarse
blocks update only once the view has moved far enough to warrant it, so a new
coarse window covers different data and min/max/mean move with it. A stationary
view does not tick at all — MobX caches the computed and nothing invalidates it —
so there is no third state in which the values repeat. Filed in
[REJECTED_IDEAS.md](REJECTED_IDEAS.md).

**So the per-tick recompute and repaint are WARRANTED work, not redundant work**,
and that closes the suppression direction entirely. What is left for this tick is
either to stagger it, so N tracks and the SearchBox stop landing on one frame — a
real option, and one that trades a briefly stale axis for smoothness — or to make
the repaint itself cheaper, which is the React/Emotion item above and not specific
to this tick at all.

Measuring it also confirms the ~500 ms period by a second route: 4 ticks over
~2.2 s of frames, arrived at with no reference to the frame gaps.

## The stop-token probe, for whoever finds it in a trace next

`probeBlobUrl` (`packages/core/src/util/stopToken.ts`) is a **synchronous XHR**
per throttled check, and it was 408 ms across six tracks' cold load. It looks
like an obvious target and is not one: the cheap path is the `SharedArrayBuffer`
branch, which needs COOP/COEP cross-origin isolation — which a browser fetching
arbitrary remote BAMs over CORS probably cannot require of its host page.

`stopToken.ts`'s own header records that the probe was deleted once and had to be
restored. Recorded here so the next person who sees it in a profile recognises it
and moves on.
