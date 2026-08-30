---
name: interaction-perf
description: 'Measured: interaction is main-thread React re-render bound, the per-frame churn is the LGV coordinate ruler creating ~144 tick divs per zoom rather than the alignments overlays, and the p99 during a multi-track pan is periodic on the 500 ms coarse tick — with the two traps that make that period look absent (testing it against the wall clock) and its size look meaningful (a loaded box, where the profile goes 83% program). Then measured again on a PRODUCTION build, which reorders that list: the ruler is 12ms and the canvas marker overlays are the top cost, because any canvas text op (ctx.font or fillText, not fillRect) flushes the whole document style recalc from inside a passive effect. Then a third instrument that needs no browser at all: a mobx.spy render census in jsdom, which agrees with the production ranking, finds the PaddingBlocks pooling bug neither profile could see, and shows ZoomTransform topping the list only because its parents re-render. Read before optimizing the wrong component, before profiling a dev build, or before quoting a frame spike measured on this machine.'
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

**Measured culprit (2026-07-11): the LGV coordinate ruler, not the alignments overlays.** A `MutationObserver` attributing every DOM mutation during a 5× zoom to its nearest `data-testid` subtree found ~2056 mutations dominated by `rubberband_controls` (the ScaleBar): 719 structural node add/remove + 439 style-attr, vs **2 of 2056** in the alignments overlays. The alignments display overlays are already zoom-invariant (`highlightBoxes` short-circuits to `[]` when nothing hovered; `renderSections`/`sections`/`laidOutByGroup` read only vertical layout, never `offsetPx`/`bpPerPx`) — **do not chase them.** `VisibleLabelsOverlay` is a canvas, so it contributes no DOM churn.

**One clause of that verdict has since expired: sashimi arcs are no longer
default-off.** `showSashimiArcs` is a promotable slot with `promotedBase: true`
(`configSchema.ts:571`), so it draws wherever coverage does, and
`sashimiArcSections` (`LinearAlignmentsDisplay/model.ts:2320-2341`) reads
`view.visibleRegions` — a fresh array every frame — so the computed invalidates
on every zoom AND pan frame, re-running `mergeJunctions` from scratch inside it.
On DNA data that costs nothing (empty flatMap, one null overlay render a frame,
the `PeptideCanvas` class) and the July verdict still holds. On spliced data it
does not: the merge kernel benches at **1.09ms per call at 4000 junction copies**
and is frame-invariant within a gesture, so it is redundant work proportional to
junction count. Unmeasured end to end — volvox's junction counts are too small
to show it, and sizing it needs an RNA-seq fixture.

The churn was `ScalebarCoordinateLabels` (`plugins/linear-genome-view/.../ScalebarCoordinateLabels.tsx`): it created and destroyed ~144 tick `<div>` nodes per zoom click. Its `key`-by-base reuse works for *pan* and not *zoom*, which is the wrong way round — `scalebarLabels` is **unchanged** during a pan (the labels live in the staticBlocks frame, and only the container transform moves), so there was nothing there to save; a zoom moves the whole tick set, so every key changed and React rebuilt the list, each new node paying the emotion/tss `tickLabel` styling cost.

**Fixed 2026-08-15 by keying the list positionally**, which makes it a pool: same nodes, patched transform and text. Measured A/B on one machine and toolchain, two builds of the same commit differing only in the key:

<!-- BEGIN GENERATED MEASUREMENT scalebar-zoom-churn -->

_Generated by `pnpm autogen` — edit the source, not this block._

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

## Profile the production build, or you will rank the wrong components

**Measured 2026-08-23**, scroll-zoom on a four-track LGV (variants + MAF +
multi-wiggle + synteny), production bundle served statically, Chrome CPU profile
resolved through the build's sourcemaps. `products/jbrowse-web/browser-tests/profile-zoom.ts`
is the harness.

The section above asks for "a React-render-level measurement (React DevTools
profiler or render counters)" as the honest next step. **Take the render COUNTS
from a dev build and nothing else.** Component costs measured there are inflated
by React's dev instrumentation — `jsxDEV`, `createTask`, `logComponentRender`,
the component performance-track measures — and the inflation is not uniform, so
it reorders the list:

| inclusive, one ~7s gesture | dev build | production |
| -------------------------- | --------: | ---------: |
| `ScalebarCoordinateLabels` |     275ms |       12ms |
| `ZoomTransform`            |     249ms |        5ms |
| `PaddingBlocks`            |     238ms |        6ms |
| `Gridlines`                |     113ms |        4ms |

A dev profile puts the coordinate ruler back at the top of the list, which is
where the 2026-07-11 mutation count also put it and where it no longer belongs
once the keys were pooled. In production the ruler is 12ms and the marker
overlays — which the DOM-mutation method could not see at all, because they are
canvases — were the top cost.

Two further traps in that measurement, both of which produced a confident wrong
answer before they were caught:

- **Charging a message its enclosing task overstates it.** Booking each
  `HandlePostMessage` the duration of the `RunTask` containing it attributed 1284ms
  (23% of main-thread busy) to worker RPC traffic. Cutting that traffic by 92%
  moved total busy time by ~0%: the tasks were mostly the renders the messages
  triggered, and true per-message overhead was ~200ms. Sum the event's own `dur`.
- **A gesture driven by `page.mouse.wheel` measures the wrong thing.** Each call
  is a CDP round trip the page's own busyness delays, so a SLOWER build ran a
  shorter gesture and traced less work. Drive the wheels from inside the page on
  a wall-clock schedule, and bound the sweep by `bpPerPx` rather than by a wheel
  count — the zoom rate limiter is per elapsed-ms, so a fixed count leaves each
  run at a different place on the scale, rendering different amounts of detail.
  Before that bound, run-to-run variance in main-thread busy was ~16% and swamped
  everything being measured.

### Any canvas text op flushes the document's style

The finding worth carrying to other overlays. Setting `ctx.font` **or** calling
`ctx.fillText` makes the browser resolve the canvas element's computed font,
which flushes the whole document's pending style recalc. `fillRect` does not.
Measured in isolation, 200 iterations against a dirty DOM: `fillRect` 11.8ms,
`ctx.font` set to the value it already holds 73.4ms, `fillText` 72.1ms — and
with the DOM clean, the same `ctx.font` write is 0.0ms.

An `OverlayCanvas` draws from a passive effect, which runs immediately after
React commits a frame of dirty inline styles, so the first overlay to touch text
is charged for the entire document recalc. MAF's deletion labels cost 272ms a
gesture and its insertion labels 385ms doing this at zoom levels where the rows
are too short to render a single letter. Both now decide whether any label will
draw before touching text state; insertions fell to 40ms.

So: **an overlay that draws text must gate the text work on something actually
being drawn**, and caching `ctx.font` yourself does not help — `fillText` pays
the same flush.

**That 40ms is regime-specific, and comparing across regimes will look like a
regression.** It was taken where the rows are too short for a letter, so the
gate suppresses the flush entirely. A sweep that spends part of its time zoomed
in enough to draw labels pays it legitimately: the default `profile-zoom` sweep
(0.5-4 bpPerPx) flushes on ~85 of ~573 frames and books ~140ms, because a
`large` insertion labels at any zoom once its row clears
`MIN_HEIGHT_FOR_TEXT` — only `small` ones wait for `MIN_PX_PER_BP_FOR_TEXT`
(6.5), which that sweep never reaches. Quote the zoom range with the number. The corollary is that the flush cost is proportional to how much
React just dirtied, which is the same "too many components re-render per frame"
problem this page has been circling, reached from the canvas side.

### What is left, in production, after 2026-08-23

The pass that landed (`perf(zoom)`, 1dd2e3f) took the median frame rate from 34
to 41fps and pinned the p50 frame interval at 16.8ms across every run, where the
baseline flipped to 32ms on a third of runs. Main-thread busy moved ~3%: the win
is frame pacing, not throughput, and the remaining budget is roughly:

- **Instance encoding on the main thread, inside the RPC message handler**:
  `mafInstanceBuffer` 126ms, wiggle `pack` 110ms, `autoscale` 111ms. These are
  the largest identified block of real compute left.
- **Stop tokens without cross-origin isolation**: `Blob` + `createObjectURL`
  94ms, plus `notifyStopToken` broadcasting to every worker in the pool, 79ms of
  `postMessage`. The section below already records why the cheap branch is out of
  reach.
- **React commit**: `react-dom` self time 651ms, `setAttribute` 81ms. Still the
  largest single block, and still the same answer — fewer components per frame.

### The four fixes after that pass, A/B'd

**Measured 2026-08-24**, same harness and session, two production builds per arm
alternating main / branch, each figure the mean of that arm's two runs.

**The control is built into the design, and read it first.** The two builds
within an arm are identical source, so their spread is this harness's floor for
that metric — the `floor` column. A row whose delta does not clear its own floor
says nothing, however plausible its mechanism, and three rows here are in that
state.

**Two instrument limits that bound every number on this page.** The top-self
list is `.slice(0, 22)` over ~920 distinct sampled frames, so a self-time figure
taken from it is a FLOOR, not a total — the `react-dom` self time reads 340ms as
four surviving frames here and 651ms in the fuller 2026-08-23 accounting, and
those are not in conflict. And `topSelf` (v8 samples) and `styleRecalc` (Blink
trace events) are independent instruments that do not subtract from each other,
so a style recalc run synchronously inside a canvas text op is plausibly counted
in both. Do not add a self-time column to a forced-recalc total.

<!-- BEGIN GENERATED MEASUREMENT zoom-token-churn -->

_Generated by `pnpm autogen` — edit the source, not this block._

| one ~7s scroll-zoom gesture         |   main | with the four fixes | A/A floor |
| ----------------------------------- | -----: | ------------------: | --------: |
| `Blob` construction, self           |   61ms |          **< 29ms** |       4ms |
| `postMessage`, self                 |  101ms |            **71ms** |       8ms |
| autoscale's two passes, self        |   74ms |              ≤ 63ms |       1ms |
| `setTimeout` + `clearTimeout`, self |  173ms |               198ms |      27ms |
| timers installed                    |    911 |                 885 |       237 |
| main-thread tasks                   | 11,235 |              10,220 |     2,570 |
| main busy, total                    | 5679ms |              5684ms |      67ms |

<!-- END GENERATED MEASUREMENT zoom-token-churn -->

Two rows clear their floor:

- **One shared `Blob` behind every token retires the whole `Blob` frame** — 61ms
  against a 4ms floor, and mechanically certain besides (one blob per session
  instead of one per token). The 61ms was the constructor, not
  `createObjectURL`, which is unchanged at ~100ms and is still the substantial
  cost — the split the 94ms figure above hides.
- **Guarding the repeat stop cuts `postMessage` by 30%**, 30ms against an 8ms
  floor: a token was stopped two or three times over and every repeat fanned out
  to the whole pool.

The rest do not, and saying which is the point of the table:

- **Task and worker-message counts are unusable here.** Main-thread tasks vary
  by ~2570 between two builds of the SAME source, so the 1015 that looked like a
  win is inside the floor by more than double. Do not quote a task count off
  this harness at all until something stabilises it.
- **The autoscale clip is not resolvable by this harness.** Its two frames sit
  near the top-self cutoff, so one arm reports them and the other does not, and
  the effect is the size of the truncation. The instrument that does resolve it
  is an isolated A/B of the function itself — 1.15–1.4x, same answer verified
  across a sweep of windows — and that is what the claim should rest on.
- **The `LoadingOverlay` timer rewrite shows nothing either way.** Its
  `setTimeout` + `clearTimeout` self time came out ~25ms worse, which reads like
  a regression until you notice the floor on that row is 27ms and that timer
  INSTALLS are flat to slightly down. Both frames aggregate every timer in the
  app and neither can isolate one hook. Keep the rewrite for its pinned
  semantics, not for a win; proving the per-pulse saving needs a counter around
  the hook, not a whole-app profile.

**`main busy` did not move, and could not have.** Its own floor is 67ms, so a
~100ms effect on a 5.7s gesture is at the edge of detection at two runs an arm.
"unchanged" here means "not detectable by this design", not "zero" — and a
design that could see it needs many more repetitions than a per-arm rebuild
makes affordable.

**Between-build drift is larger than an arm's internal spread suggests.**
`deletions.ts`, which neither arm's change touches, came out 17ms lower in the
branch arm across both pairs. Treat ~17ms as the practical floor for any single
self-time frame here, not the 4-8ms the tighter rows imply.

## Count the renders in jsdom before you profile a build

**Built 2026-08-30**, and it is the instrument this page asks for four times
over — "pinning down which ones needs a React-render-level measurement (React
DevTools profiler or render counters), not a CPU flame graph". It needs neither
of those, and no browser.

`mobx-react-lite` names every function component's reaction
`observer<ComponentName>`, and `Reaction.track` wraps the render itself rather
than only the invalidation, so `mobx.spy()` filtered to `type: 'reaction'`
events **is** the per-component render count, with no component instrumented.
`products/jbrowse-web/src/tests/renderCensus.ts` is that; `ZoomRenderCensus.test.tsx`
drives a geometric `zoomTo` ramp over a real multi-track session and prints the
ranked count beside a `MutationObserver` tally of where the DOM churn lands.
One run, ~20s, no rebuild per arm. It prints a one-line summary per arm; pass
`ZOOM_CENSUS=1` for the per-component tables.

**Two limits, and a budget written here must respect both.** A child re-rendered
purely by a parent's fresh props runs no reaction of its own, and `mobx` reports
spy events only in its development build — so a count is a FLOOR on React's real
work. And only part of it is deterministic: the overlay, ruler and scalebar
components are a function of the zoom steps alone and repeat to the integer,
while anything downstream of a fetch (`DisplayLoadingOverlay`,
`DisplayChromeBaseInner`, `FetchVisibleRegions`, `AppReadyMarker`) moved by up
to 2x between runs of identical source, because how many refetch rounds land
inside 20 frames is a wall-clock race. Quote the first group; read the second.

### What it says about the production ranking above

The dev-build table above warns that dev profiles reorder the component list,
and this is a third instrument agreeing with the production column rather than
the dev one — with one addition it can see and neither profile could.

**`ZoomTransform` tops the census and is not a target.** 7.6 renders a frame,
and its total is `PaddingBlocks` + `Gridlines` **exactly**: 152 = 114 + 38 over
20 frames. `observer` wraps `React.memo`, and a fresh `children` element defeats
the compare, so it re-renders once per parent render and has no reaction of its
own to stop; dropping `observer` from it would save nothing. Do that arithmetic
on any wrapper before optimizing it.

**Structural churn was still the expensive class, and `PaddingBlocks` had the
scalebar's bug.** It keyed its divs by block identity; a zoom moves every block,
so React rebuilt the list each frame — in a component mounted once per track
plus once for the container, so the cost scaled with the session. At eight
tracks that was **360 structural mutations over 20 frames**, and the entry
leaves the tally once the list is keyed positionally. The July DOM-mutation
sweep could not have found it: that method attributes to the nearest
`data-testid`, and these divs sit under `tracksContainer` with every other
overlay.

**The largest single win was an overlay that had nothing to draw.** A view
sitting inside one contig has no region seam, no elision and no boundary, so
`paddingSpans` is empty — and that is where a reader spends nearly all of a
session, not an edge case. Every track still mounted a `PaddingBlocks` that
rendered an empty list inside a `ZoomTransform`, and that wrapper reads
`staticBlocks`, so each one re-rendered and rewrote its transform every frame of
every gesture to position nothing. Returning one shared frozen array from the
getter (so the computed's value repeats and MobX stops there) and `null` from
the component took a 20-frame zoom at four tracks from **761 observer renders to
489, and 63.9 DOM mutations a frame to 50.5** — `PaddingBlocks` leaves the census
and `ZoomTransform` falls 160 to 40, `Gridlines` being its only parent left.
Both scale with the track count.

Worth stating as a rule, because it is invisible to every profile above: **a
computed that rebuilds a fresh empty array is not free — it re-renders every
observer that reads it.** The arms of this census that start at offset 0 keep a
boundary block on screen throughout and never see this at all, which is why the
mid-contig arm exists.

**The rule that generalises is narrower than "pool every list".** A zoom changes
every `paddingSpan` key and every scalebar tick key, which is what made those
two rebuild wholesale. It does not change a feature's id, so
`FloatingLabelsLayer` already pools across a zoom and only culling churns it —
positional keys there would trade a handful of mounts for repainting every
surviving label. Pool where the gesture changes every key.

**An array-rebuilding computed re-renders every observer that reads it, and the
clamp has to be inside.** `visibleRegions` rebuilds fresh objects every frame,
so both wiggle bodies re-rendered per frame to derive a legend edge that is
usually the unchanged `trackWidthPx` — 66 renders over 20 frames, 7 after the
view published `contentRightEdgePx`. Publishing the raw edge would have changed
nothing: `Math.min(trackWidthPx, …)` is what makes the value repeat, so it has
to happen where MobX can stop at it.

## The census checked against a real browser

**Measured 2026-08-30**, headed Chrome on a real GPU, production build,
`ctgA:20000-24000` with eight tracks, six zoom clicks, one build per arm.
`products/jbrowse-web/browser-tests/probe-zoom-churn.ts` is the harness — the
browser counterpart of the jsdom census, attributing every DOM mutation to its
nearest `data-testid` the way the 2026-07-11 sweep did.

| mid-contig, 8 tracks, 6 zoom clicks    |  main | with the padding-overlay fixes |
| -------------------------------------- | ----: | -----------------------------: |
| DOM elements                            |   571 |                            541 |
| elements carrying an inline `translateX`|    40 |                             30 |
| attr churn, `ZoomTransform` containers under `tracksContainer` | 920 | **90-96** |
| DOM mutations, total                    | 3,375 |                    2,762-2,823 |

Ten fewer elements carry a `translateX`, and the count is exactly accounted
for: `PaddingBlocks` mounts once per track (`TrackContainer`), once for
`TracksContainer` and once for the `Scalebar`, so eight tracks is ten instances,
and mid-contig none of them renders. The per-frame attribute churn on them falls
by **90%**. That is the jsdom census's
`ZoomTransform` 160 -> 40 reproduced in a browser, at twice the track count, so
the jsdom numbers describe the app rather than the shim.

**Read the structural row as noise here, and it is instructive why.**
Mid-contig `paddingSpans` is empty on BOTH arms, so the positional-key fix has
nothing to pool and contributes nothing; the structural counts came out 545,
628 and 706 across three runs of two arms, which is the scalebar tick pool and
fetch-driven label churn moving run to run. The two fixes have different
regimes, and a single sweep cannot show both: the keys matter where spans exist
(genome start, multi-region, whole-genome) and the empty-return matters where
they do not. Running the same probe with `--start` confirms the other half is
intact — `paddingSpans` 1, 45 translated elements against mid-contig's 30, so
the overlay still renders where it has something to draw.

**Do not profile this headless.** A first attempt through `profile-zoom.ts`
with `HEADLESS=1` came back with `fillRect` at 2,756ms of 5,938ms sampled and an
empty `component renders:` list: headless Chrome fell through WebGL to Canvas2D,
and eight wiggle tracks drawing bar-by-bar swamped every signal the run was for.
The harness's own note says the React/DOM side is the same headless — it is, but
only if something else is not eating the trace. Use `--headed`.

## The stop-token probe, for whoever finds it in a trace next

`probeBlobUrl` (`packages/core/src/util/stopToken.ts`) is a **synchronous XHR**
per throttled check, and it was 408 ms across six tracks' cold load. It looks
like an obvious target and is not one: the cheap path is the `SharedArrayBuffer`
branch, which needs COOP/COEP cross-origin isolation — which a browser fetching
arbitrary remote BAMs over CORS probably cannot require of its host page.

`stopToken.ts`'s own header records that the probe was deleted once and had to be
restored. Recorded here so the next person who sees it in a profile recognises it
and moves on.

**The ~100ms `createObjectURL` frame beside it is not the mints either**, counted
2026-08-30: a 20-frame zoom over four tracks mints **8** tokens
(`ZoomStopTokenMints.test.tsx`, which has to install a `URL.createObjectURL`
because jsdom has none and every token under jest is otherwise a `nanoid`). The
rate is per fetch round rather than per frame, so jsdom's round count is not a
browser's — but nothing in the plausible range rescues it, since even a few
hundred mints a gesture would put a registry insert at 0.3ms a call. Whatever
that frame contains, attribute it before designing against it;
[REJECTED_IDEAS.md](REJECTED_IDEAS.md) carries the declined design.
