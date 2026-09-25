---
name: zoom-perf-followups
description: What survives after the render-count instrument this file asked for was built (2026-08-30) and pointed at the list. The instrument found two PaddingBlocks bugs nothing here predicted — the bigger one an overlay every track re-renders per frame to draw nothing, since paddingSpans is empty mid-contig. The live item left is worker-side wiggle packing, blocked on a retention decision.
---

# Scroll-zoom: what is left

Follow-ups from the 2026-08-23 pass (`perf(zoom)`) and the four fixes after it,
re-investigated 2026-08-24 after those four were A/B'd. The A/B is in
[reference/INTERACTION_PERF.md](../../reference/INTERACTION_PERF.md), and its
instrument caveats there are load-bearing for everything below: the top-self
list shows 22 of ~920 sampled frames, so every self-time figure quoted here is a
floor.

Three things this file used to propose are declined: the MAF overlay
flush, moving MAF's packing to the worker, and folding content staleness into
`displayPhase`.

## The render-count gate: built, and what it found

`products/jbrowse-web/src/tests/renderCensus.ts`, driven by
`ZoomRenderCensus.test.tsx`. It works exactly as this section predicted:
`mobx-react-lite` names every observer's reaction `observer<ComponentName>` and
`Reaction.track` wraps the render itself, so a `mobx.spy()` filtered to reaction
events is a per-component render count with no component instrumented. It prints
that ranked beside a `MutationObserver` tally of where the DOM churn lands, over
a geometric `zoomTo` ramp over arms from four tracks to mid-contig, a gene track
at label zoom, spliced alignments and a link track.

**Take the view-geometry counts as exact and the rest as approximate.** The
overlay, ruler and scalebar components are a function of the zoom steps alone
and repeat to the integer between runs; anything downstream of a fetch
(`DisplayLoadingOverlay`, `DisplayChromeBaseInner`, `FetchVisibleRegions`,
`AppReadyMarker`) moved by up to 2x across runs of identical source, because how
many refetch rounds land inside 20 frames is a wall-clock race. The census
asserts a per-gesture bound on each wiggle body, no `PaddingBlocks` render at
all mid-contig, and no per-link component or DOM churn in the links arm; the rest is
a readout. Both wiggle bodies sit at 0 when the scalar holds, and the sabotage
puts `WiggleBody` at 50 against its bound of 20 but `MultiWiggleBody` at only
19 — so the two bounds cannot be the same number. `WiggleBody` keeps `FRAMES`,
2.5x under what it catches; `MultiWiggleBody` is `FRAMES / 4`, since `FRAMES`
there passed the sabotage by one render and caught nothing at all. The headroom
each keeps is what makes it safe against a residual that includes fetch-driven
renders, and the links arm's mutation bound is loose for the same reason — the chrome's own
`data-display-phase` flips when a refetch round lands inside the 20 frames,
which the arm has seen contribute both 0 and 2 against a per-link cost of 240.

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
  frozen empty array plus a `null` return took a mid-contig zoom from 63.9 DOM
  mutations a frame to 50.5 and `ZoomTransform` from 160 renders to 40, at four
  tracks. The gesture's render total moves too much between runs to quote. Every
  census arm that starts at offset 0 keeps a boundary block on screen and cannot
  see this, which is the trap: **a computed rebuilding a fresh empty array
  re-renders every observer that reads it.**

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

## Wiggle instance packing could move to the worker

`wiggleInstanceBuffer.pack` is **measured ~98ms**, run synchronously inside the
RPC message handler so it lands mid-frame. A zoom across a BigWig tier
already refetches (ADR-125), so a worker-side pack rides along free there;
`MafUploadPayload` is the payload shape to copy.

**"Move `pack`" understates the move, and `origin` is how you see it.**
`pack` takes `SourceRenderData[]`, which is what `buildSourceRenderData` returns
— so the worker would have to run that too, or receive the expanded form over
the wire, which is the thing being avoided. And `buildSourceRenderData` is where
the pivot lives: `sourceLayers` colours every band around it, which is why
the resolved colour and its `origin` sit in **`gpuProps`** and, since the
worker-side split was deleted (ADR-016, superseded), nowhere else. The ENCODER is what needs the
value — the SVG export calls `buildSourceRenderData(data, gpuProps)` directly
(`LinearWiggleDisplay/renderSvg.tsx:38`) and would otherwise colour its bands
around nothing. A worker-side pack would have to be handed the pivot as a pack
argument rather than reading it off the fetch. Availability is not the
obstacle.

**The obstacle is that the encoder cannot leave, only be duplicated.**
`installUpload` re-encodes **every cached region** whenever `gpuProps` identity
moves (`installUpload.ts:195-198`: `p !== lastProps` clears `encodedFrom`), and
most of what moves it — colour, plot type, summary score mode, re-sort — does
**not** refetch. Those have to be served main-thread. So a worker-side pack adds
a second encoder rather than relocating the first, and the two must agree
forever.

That O(N cached regions x K) main-thread re-encode is exactly the cost
[ADR-016](../../architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md)
measured when the proposal was to move the pos/neg split the OTHER way,
main-thread-ward. That ADR is superseded — the split was deleted rather than
moved — but it does not forbid this move, and its argument runs in its favour, since a worker-side encode is the O(K)-per-region side it preferred
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
- **The zoom slider is the largest single-element churn left, and it stays.**
  MUI's `Slider` patches `name`, `value`, `type`, `aria-valuenow` and two
  `style`s on its thumb and track per render — **5.7 DOM mutations a frame**,
  more than `PaddingBlocks` now costs. The obvious move is the one `SearchBox`
  made, reading `coarseBpPerPx` instead of live `bpPerPx`, and it is refused on
  purpose: `HeaderZoomControls`' own styles comment records killing MUI's 150ms
  thumb transition *so the thumb stops trailing the zoom it reports*. Coarsening
  the value re-introduces exactly that, deliberately. A drag is unaffected either
  way — it reads local `dragValue`, not the model.
- **The wheel-driven arm books 2158ms in rAF callbacks** against the scripted
  arm's much smaller figure for the same applied zoom, which points at the wheel
  controller and zoom spring rather than at rendering. The two runs did not
  cover the same `bpPerPx` range, so the number means nothing until the
  comparison is matched — the same trap that made the label A/B look like a win
  ([reference/INTERACTION_PERF.md](../../reference/INTERACTION_PERF.md) §"Zoom is
  the worse of the two gestures").
- **Three overlays set `ctx.font` ungated** —
  `drawVariantInsertionGlyphs.ts:147`, `drawMultiRowIndelGlyphs.ts:113`,
  `drawOffscreenMates.ts:763`. Same bug MAF already fixed. Hygiene only: per
  agent-docs/architecture-decision-records/ they would win nothing, only change whose name is in the
  profile.
