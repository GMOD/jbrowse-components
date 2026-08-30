---
name: zoom-perf-followups
description: What survives after the render-count instrument this file asked for was built (2026-08-30) and pointed at the list. The instrument found two PaddingBlocks bugs nothing here predicted — the bigger one an overlay every track re-renders per frame to draw nothing, since paddingSpans is empty mid-contig — made the legendRightEdgePx item three times bigger than it was sold as, killed the stop-token blob URL item outright by counting the mints, and then found the only per-FEATURE per-frame cost in the app, in plugins/arc, whose fix moved that cost to a canvas whose own price is timed here. Two live items are left — worker-side wiggle packing, blocked on a retention decision, and the arc labels.
---

# Scroll-zoom: what is left

Follow-ups from the 2026-08-23 pass (`perf(zoom)`) and the four fixes after it,
re-investigated 2026-08-24 after those four were A/B'd. The A/B is in
[reference/INTERACTION_PERF.md](../reference/INTERACTION_PERF.md), and its
instrument caveats there are load-bearing for everything below: the top-self
list shows 22 of ~920 sampled frames, so every self-time figure quoted here is a
floor.

Three things this file used to propose are now in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md): the MAF overlay
flush, moving MAF's packing to the worker, and folding content staleness into
`displayPhase`.

## The render-count gate: built, and what it found

`products/jbrowse-web/src/tests/renderCensus.ts`, driven by
`ZoomRenderCensus.test.tsx`. It works exactly as this section predicted:
`mobx-react-lite` names every observer's reaction `observer<ComponentName>` and
`Reaction.track` wraps the render itself, so a `mobx.spy()` filtered to reaction
events is a per-component render count with no component instrumented. It prints
that ranked beside a `MutationObserver` tally of where the DOM churn lands, over
a geometric `zoomTo` ramp at five arms — four tracks, eight tracks, mid-contig,
a gene track at label zoom, and an arc band.

**Take the view-geometry counts as exact and the rest as approximate.** The
overlay, ruler and scalebar components are a function of the zoom steps alone
and repeat to the integer between runs; anything downstream of a fetch
(`DisplayLoadingOverlay`, `DisplayChromeBaseInner`, `FetchVisibleRegions`,
`AppReadyMarker`) moved by up to 2x across runs of identical source, because how
many refetch rounds land inside 20 frames is a wall-clock race. The census
asserts a per-gesture bound on each wiggle body, no `PaddingBlocks` render at
all mid-contig, and no per-arc component or DOM churn in the arc arm; the rest is
a readout. The two wiggle bounds sit ~3x under the counts they catch, which is
what makes them safe against a residual that includes fetch-driven renders, and
the arc arm's mutation bound is loose for the same reason — the chrome's own
`data-display-phase` flips when a refetch round lands inside the 20 frames,
which the arm has seen contribute both 0 and 2 against a per-arc cost of 240.

Three things it found, in the order they mattered:

- **`PaddingBlocks` keyed its divs by block identity**, and a zoom moves every
  block, so React rebuilt the whole list every frame rather than patching it —
  `ScalebarCoordinateLabels`' bug, in a component mounted once per track plus
  once for the container. At eight tracks that was **360 structural mutations
  over 20 frames, and the entry disappears from the tally** once the list is
  keyed positionally. Nothing on this page predicted it, and the DOM-mutation
  method that found the scalebar in July could not have: it attributes to the
  nearest `data-testid`, and these divs sit under `tracksContainer` with every
  other overlay.

- **The biggest win was an overlay with nothing to draw**, which nothing on
  this page or in `INTERACTION_PERF` had looked for. `paddingSpans` is EMPTY
  mid-contig — no seam, no elision, no boundary — which is where a reader spends
  nearly all of a session, and every track was still rendering an empty list
  inside a `ZoomTransform` that rewrites its transform per frame. A shared
  frozen empty array plus a `null` return took a mid-contig zoom from 761
  renders to 489 and 63.9 DOM mutations a frame to 50.5, at four tracks. Every
  census arm that starts at offset 0 keeps a boundary block on screen and cannot
  see this, which is the trap: **a computed rebuilding a fresh empty array
  re-renders every observer that reads it.**

- **`legendRightEdgePx` was three times the size it was sold as** below. Not
  "under 20ms, invisible to the profiler" — it was **one render per wiggle
  track per frame**: 66 renders over 20 frames from THREE wiggle-family body
  instances — `volvox_gc` mounts the wiggle component too — reported under two
  component names, and 7 after. The fix is
  not the one written below either: publishing the raw scalar changes nothing,
  because the clamp is what makes it stable. `Math.min(trackWidthPx, …)` has to
  happen INSIDE the computed, which is why `contentRightEdgePx` is a view getter
  and not a helper the component calls.

- **`ZoomTransform` is not a target, and looks like the biggest one.** It tops
  the census at 7.6 renders a frame, and its count is `PaddingBlocks` +
  `Gridlines` **exactly** (152 = 114 + 38 over 20 frames). It re-renders because
  its parent does — `observer` wraps `React.memo`, and a fresh `children`
  element defeats the compare every time — so it has no reaction of its own to
  stop and dropping `observer` from it saves nothing. Check that arithmetic
  before optimizing anything that renders as a wrapper.

### The one per-FEATURE cost in the app was `plugins/arc`

Every other per-frame cost this instrument ranks is view-global or paid once per
TRACK. Arc was neither: it rendered **one `observer` per visible arc**, each
reading `getCanonicalRefName2` and two `bpToPx` and `offsetPx` for itself. So a
zoom ran a reaction, rebuilt a path string and patched three SVG attributes per
arc per frame, per track, on both gestures.

At **four** arcs on screen (`arc_track` + `volvox_bedpe`, 1→16 bp/px, 20 frames)
that was 26.5 renders and 47.0 DOM mutations a frame, of which arc owned 8
renders and 12.0 mutations — a quarter of the whole view's frame, for four arcs.
Two thirds of the mutations were the LABELS: 160 `attr:x` over the two stacked
`<text>` elements against 80 `attr:d` on the paths. A real SV bedpe or VCF track
carries 10²-10⁴ arcs in view.

**Fixed by drawing the band on one canvas** (`perf(arc)`, 2026-08-30): 19.5
renders and 35.0 mutations a frame, with arc contributing **one render and zero
mutations**. Take arc's own share as the measurement and the view-wide totals as
a readout — the two agree exactly here (26.5 - 8 + 1 = 19.5, 47.0 - 12.0 = 35.0),
which is what says nothing else in the arm moved, and a re-run gave 19.0/34.5 on
the fetch-round jitter this instrument's caveats describe.

The per-arc terms are gone rather than smaller, which is the part that matters:
the numbers above would have been ~2000 reactions and ~3000 attribute patches a
frame at 1000 arcs.

**What the canvas costs instead, and it is not nothing.** The census measures
React renders and DOM churn; it cannot see rasterization, and the per-arc work
did not vanish so much as move to one `ctx.stroke()` per arc. Timed against
node-canvas over a 1280x100 band, 60 frames a point:

- 66 arcs on screen, no labels — 3.5 ms/frame
- 670 — 37 ms/frame; 3360 — 183 ms/frame
- 670 **with labels** — 134 ms/frame, so the text is ~3.6x the curves
- those 670 labels alone: halo+fill 132 ms, fill only 26 ms — **the halo is 5x
  its own fill**, and it is a 7.2px round-join `strokeText` per label

Read those as an upper bound and a SHAPE, not as browser numbers: node-canvas is
Cairo on the CPU, where a browser's 2D canvas is GPU-backed and stroking is the
part it accelerates. What they do say is where to look if a real SV callset is
slow — the labels, then the per-arc stroke call.

**The obvious label fix measured negative.** A label sits at the arc's midpoint
while the arc is kept for having any ink on screen, so a wide event with one foot
in view puts its label thousands of px off canvas: on a fixture of 1000 wide arcs
with 977 such labels, skipping them ought to be free. It made the frame **64 ms
-> 72 ms**. `measureText` — needed to know whether an off-LEFT label ends before
x=0 — costs more than the rasterizer's own out-of-bounds reject. Not landed. A
cull that skips text without measuring it (a cap on labels per frame, or a
density gate) is the shape that could still win, and it is a product call about
labels nobody can read at that zoom anyway.

Three things generalise from it:

- **`ArcGlyph`'s count equalled `Arc`'s exactly** (80 = 80), the `ZoomTransform`
  arithmetic above, so it had no reaction of its own to stop. Do that
  subtraction on any wrapper before treating it as a cost.
- **The projection belongs on the model, not in the component.** `laidOutArcs`
  is a MobX computed, so it re-places arcs when the viewport moves and not when
  a hover redraws them. A component body cannot make that distinction.
- **SVG's free hit-testing is no longer worth a per-frame DOM.**
  `pointer-events: stroke` is what kept these as `<path>`s; `hitTestArcs` plus
  `@jbrowse/sv-core`'s `bestArcMark` replaces it, and the export keeps vector
  because an export runs once. `reference/SVG_EXPORT.md` carries the amended
  exception, including the invariant that made the split safe.

**The lesson is not "pool every list by position".** A zoom changes every
`paddingSpan` key and every scalebar tick key, which is what made those two
rebuild whole lists; it does not change a feature's id, so `FloatingLabelsLayer`
already pools across a zoom and only culling churns it. Positional keys there
would trade a handful of mounts for repainting every surviving label's text.
Pool where the gesture changes every key.

## Retire the stop-token blob URL — dead, and the count is why

**Moved to [reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md)
2026-08-30.** This section ended with "do first, before any of the work: count
the mints", and that was the right instinct: a 20-frame zoom over four tracks
mints **8**. Even extrapolated generously to a few hundred a gesture, the ~100ms
frame would put `URL.createObjectURL` at 0.3ms a call, and a registry insert is
not that. The frame is something else — plausibly the revoke or the GC of the
revoked entries, as this section already suspected — and the `syncProbe` opt-in
designed below buys none of it.

`products/jbrowse-web/src/tests/ZoomStopTokenMints.test.tsx` is the count, and
it needs no browser: the rotation that mints is model-side. The one thing it has
to do is install a `URL.createObjectURL`, because jsdom has none and every token
under jest is otherwise a `nanoid` — the browser branch never runs, and a naive
count reads zero.

Everything the old section established about the *shape* of the fix stands and
is now unused: ~27 probe-dependent sites rather than six, `clusterMatrix`
un-chunkable because its callback is invoked from inside one synchronous WASM
call, and the header's "deleted once and had to be restored" being a misreading
of a development-time revert. If the frame is ever attributed to something real,
that is the design to start from.

## Wiggle instance packing could move to the worker

`wiggleInstanceBuffer.pack` is **measured ~98ms**, run synchronously inside the
RPC message handler so it lands mid-frame. Wiggle's `regionFetchKey` is
`String(bpPerPx)`, so a zoom already refetches and a worker-side pack rides along
free; `MafUploadPayload` is the payload shape to copy.

**"Move `pack`" understates the move, and `bicolorPivot` is how you see it.**
`pack` takes `SourceRenderData[]`, which is what `buildSourceRenderData` returns
— so the worker would have to run that too, or receive the expanded form over
the wire, which is the thing being avoided. And `buildSourceRenderData` is where
the pivot lives: `sourceLayers` colours the whiskers bands around it
(`buildSourceRenderData.ts:204`), which is why `bicolorPivot` sits in
**`gpuProps` as well as `rpcProps`**. The second copy is there because the
ENCODER needs the value — the SVG export calls `buildSourceRenderData(data,
gpuProps)` directly (`LinearWiggleDisplay/renderSvg.tsx:38`) and would otherwise
colour its bands around nothing. It rides along as an invalidation key; it is
not there for invalidation, since a pivot change already refetches through
`rpcProps` and a refetch re-encodes every region anyway. The worker has the
value too. Availability is not the obstacle.

**The obstacle is that the encoder cannot leave, only be duplicated.**
`installUpload` re-encodes **every cached region** whenever `gpuProps` identity
moves (`installUpload.ts:195-198`: `p !== lastProps` clears `encodedFrom`), and
most of what moves it — colour, plot type, summary score mode, re-sort — does
**not** refetch. Those have to be served main-thread. So a worker-side pack adds
a second encoder rather than relocating the first, and the two must agree
forever.

That O(N cached regions x K) main-thread re-encode is exactly the cost
[ADR-016](../architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md)
measured and refused when the proposal was to move the pos/neg split the OTHER
way, main-thread-ward. The ADR does not forbid this move — its argument runs in
its favour, since a worker-side encode is the O(K)-per-region side it preferred
— but it is the same accounting, and its rule ("only move worker computation to
`gpuProps` when the setting changes frequently AND the per-feature work is cheap
or expressible as a uniform") is what a reader should apply here.

**The blocker nobody listed is retention.** Today the packed buffer is
transient — pack, upload, garbage. In the upload payload it is resident for the
life of the region, twice over (`mapUploadSync` also holds it, and payloads are
documented immutable so it cannot be nulled after upload). Wiggle's own comment
puts that at **82MB for a 1000-source multiwiggle at a 1Mb view**
(`wiggleInstanceBuffer.ts:33`). That is the decision, not a detail.

**Of the old obstacle list, two counts were wrong and one is thinner than it
reads.** Colour strings parse fine in a worker (`colorBits.ts` is a pure parser,
and wiggle's colours are config slots, not theme reads — the theme-flip hazard
was imported from MAF by analogy). Multi-wiggle already ships
`summaryScoreMode` worker-side — but note that answers the *mode*, not the
*pivot* the bands are coloured around, which is the paragraph above and a
separate input to the same call. `rowIndex` is genuinely main-thread-bound, and
worse than stated: the ordered source list is derived from the fetched data
itself, so a fetch discovering a new source cannot be told its own row
assignment.

Its ~98ms is **~8ms per fetch round over ~11-12 rounds** — pacing, not
throughput. Anyone selling it as "5.68s -> 5.58s" is quoting noise; it is
verifiable only as a frame leaving the top-self list.

Order if taken: measure `pack` in isolation first (a whole-gesture A/B cannot
resolve it), settle retention, decide whether two encoders that must agree is a
price worth paying, and only then write the plumbing.

## Smaller, measured, unclaimed

- **The gene-label regime, measured.** This entry used to say the profiled sweep
  might be the wrong one and that `FloatingLabelsLayer` was "plausibly the
  largest per-frame list in the app" at 10-500 bpPerPx. Censused there
  (`ZoomRenderCensus`'s gene arm, 10-69 bpPerPx): the layer renders **under once
  per frame**, and its structural churn is 1.6 mutations a frame against the
  scalebar and overlay chrome's 55 attribute writes. It is the top *attribute*
  churn once a variant track is on — every visible label's transform moves on a
  zoom, which it owes — and it is not the structural problem the entry expected.
  The volvox gene track is small, so this bounds the claim rather than settling
  it; the arm to widen is the fixture, not the regime.
- **`legendRightEdgePx`** — done 2026-08-30, and see the instrument section
  above for why the entry undersold it (one render per wiggle track per frame,
  not "under 20ms") and mis-stated the fix (the clamp has to be inside the
  computed). The view getter is `contentRightEdgePx`; the rule moved to
  `display-kit/regionHost` because the SVG export needs it against the export's
  canvas width.
- **The zoom slider is the largest single-element churn left, and it stays.**
  MUI's `Slider` patches `name`, `value`, `type`, `aria-valuenow` and two
  `style`s on its thumb and track per render — **5.7 DOM mutations a frame**,
  more than `PaddingBlocks` now costs. The obvious move is the one `SearchBox`
  made, reading `coarseBpPerPx` instead of live `bpPerPx`, and it is refused on
  purpose: `HeaderZoomControls`' own styles comment records killing MUI's 150ms
  thumb transition *so the thumb stops trailing the zoom it reports*. Coarsening
  the value re-introduces exactly that, deliberately. A drag is unaffected either
  way — it reads local `dragValue`, not the model.
- **Three overlays set `ctx.font` ungated** —
  `drawVariantInsertionGlyphs.ts:147`, `drawMultiRowIndelGlyphs.ts:113`,
  `drawOffscreenMates.ts:763`. Same bug MAF already fixed. Hygiene only: per
  REJECTED_IDEAS they would win nothing, only change whose name is in the
  profile.
