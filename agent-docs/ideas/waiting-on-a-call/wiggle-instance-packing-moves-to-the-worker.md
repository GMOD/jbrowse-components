---
name: wiggle-instance-packing-moves-to-the-worker
description: wiggleInstanceBuffer.pack runs ~98ms synchronously in the RPC handler, and a worker-side pack would ride along free on a tier refetch — but the encoder cannot leave the main thread, only be duplicated, and the packed buffer would become resident at up to 82MB for a 1000-source multiwiggle. The call is whether that retention and two encoders that must agree are worth a frame.
---

# Wiggle instance packing could move to the worker

Split out of the zoom-perf follow-ups collection on 2026-09-27; its measured
findings are in
[reference/INTERACTION_PERF.md](../../reference/INTERACTION_PERF.md) §"Count the
renders in jsdom before you profile a build".
[wiggle-instance-records-carry-per-row-constants](../ready/wiggle-instance-records-carry-per-row-constants.md)
shrinks the same buffer.


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
