---
name: zoom-perf-followups
description: What survives after the render-count instrument this file asked for was built (2026-08-30) and pointed at the list. The instrument found two PaddingBlocks bugs nothing here predicted — the bigger one an overlay every track re-renders per frame to draw nothing, since paddingSpans is empty mid-contig — made the legendRightEdgePx item three times bigger than it was sold as, and killed the stop-token blob URL item outright by counting the mints. One live item is left — worker-side wiggle packing, blocked on a retention decision.
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
a geometric `zoomTo` ramp at three arms — four tracks, eight tracks, and a gene
track at label zoom.

**Take the view-geometry counts as exact and the rest as approximate.** The
overlay, ruler and scalebar components are a function of the zoom steps alone
and repeat to the integer between runs; anything downstream of a fetch
(`DisplayLoadingOverlay`, `DisplayChromeBaseInner`, `FetchVisibleRegions`,
`AppReadyMarker`) moved by up to 2x across runs of identical source, because how
many refetch rounds land inside 20 frames is a wall-clock race. The census
asserts one budget, on a component in the first group; the rest is a readout.

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
  track per frame**, 66 over 20 frames across two bodies, 7 after. The fix is
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
