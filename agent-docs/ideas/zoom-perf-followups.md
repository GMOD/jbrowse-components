---
name: zoom-perf-followups
description: What survived a four-way investigation of the 2026-08-23 scroll-zoom pass. Two live items — an opt-in sync probe that collects the stop-token blob URL without touching the un-chunkable WASM clustering call, and worker-side wiggle packing that is blocked on a retention decision — plus the deterministic render-count instrument that should be built before any of it. The MAF and displayPhase items moved to REJECTED_IDEAS.
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

## Build the render-count gate first

Everything below is bounded by an instrument problem, not an idea problem. The
browser profile is truncated, noisy (~17ms floor on a single self-time frame,
67ms on total main busy) and needs a rebuild per arm; resolving a ~100ms effect
in it needs ≥8 runs an arm.

`mobx-react-lite` names every observer's reaction `observer<ComponentName>`, so
`mobx.spy()` filtered to reaction events yields a **per-component render count
with no instrumentation of any component** — integers, in jsdom, deterministic,
one run. Drive N `model.zoomTo()` steps over a multi-track LGV in the style of
`searchBoxPanRenders.test.tsx` and assert a budget.

That is what turns "fewer components re-render per frame" — prescribed by this
page in July, August and again now, never executed — into a gate that survives
its author. An afternoon, and it makes the claim falsifiable for the first time.

## Retire the stop-token blob URL, opt-in rather than outright

`createStopToken` mints `URL.createObjectURL`, **measured ~100ms** of main-thread
self time on one ~7s gesture. (Sharing one `Blob` behind every token landed
2026-08-24 and took a separate ~61ms; the mint itself is what is left.) The blob
URL exists so `probeBlobUrl` — a synchronous XHR — has something to fail against
once revoked, giving a **synchronous** cancellation check no plain-id lookup can.

**The earlier version of this section said six call sites need the probe and that
the zoom path is fully chunked. Both are wrong.** There are ~27 probe-dependent
sites: 26 direct `checkStopTokenThrottled` calls plus everything driven through
`createProgressReporter` (`packages/core/src/util/progress.ts:1088`), and
several — `BamAdapter.ts:211`, `extractFeatureArrays.ts:123`,
`runCoveragePipeline.ts:96` — are squarely on the zoom path. The reason they do
not matter is a **measurement**, not a structural property: `cancel-bench`
measured the alignments family probe-on vs probe-off and got nothing (median
settle 513ms both arms). Everything outside that family is unmeasured.

**`clusterMatrix` cannot be chunked, and it decides the shape of the fix.**
`packages/tree-sidebar/src/clusterMatrix.ts:67` is not a loop — it is the
`checkCancellation` callback handed to `@gmod/hclust`, registered with
`module.addFunction` and invoked from inside one synchronous
`module._hierarchicalCluster` call. A JS callback called from WASM cannot await;
there is no seam at any stride. All three cluster executors funnel through it,
so four of the "six" collapse into one un-chunkable call.
`executeRenderHicData.ts:89` is the same exposure one step down.

**The header's "deleted once and had to be restored" is a misreading.**
`git log --all -S XMLHttpRequest` on `stopToken.ts` returns one commit, the pnpm
move; the XHR count is 1 at every commit in the file's history. The deletion
never landed — it happened inside the development of `2816289219` and was
restored on a reasoned counter-example (`getLDMatrix`'s O(n²) fill), not an
observed failure. `probeBlobUrl` is inert under jsdom, so deleting it passes all
6000+ unit tests either way.

**The shape that works**: `createStopToken({ syncProbe })`, defaulting off, with
a display able to declare it (`createStopTokenRotation(self, report, {
syncProbe })`). The un-chunkable paths mint through their own entry points —
`useClusterRun.ts:66`, `runClusteringAutorun.ts:102`, `DiagonalizeDialog.tsx:86`,
`indexJobsModel.ts:309` — at single-digit frequency, where a blob URL costs
nothing. The zoom-hot rotation gets a bare `nanoid()`. An explicit enumerable
list that fails at the call site, not a `functionName` registry that fails
silently in a worker.

**Do first, before any of the work**: count the mints. ~100ms over a few dozen
tokens a gesture is ~2.5ms per call, implausible for a registry insert and a
strong hint the sampler folds the revoke or GC into that frame. The counter
already exists — `fetch-cancellation.ts:79-82` patches `URL.createObjectURL`.
Ten minutes either sizes the prize or redirects the effort. Confirmation
afterwards is presence/absence, not a delta: the frame leaves the profile and
`blobUrls` reads 0.

**Do not** reach for the `SharedArrayBuffer` branch; ADR-056 rejected the
cross-origin isolation it needs.

## Wiggle instance packing could move to the worker

`wiggleInstanceBuffer.pack` is **measured ~98ms**, run synchronously inside the
RPC message handler so it lands mid-frame. Wiggle's `regionFetchKey` is
`String(bpPerPx)`, so a zoom already refetches and a worker-side pack rides along
free; `MafUploadPayload` is the payload shape to copy.

**The obstacle list this file used to carry was wrong on two of three counts.**
Colour strings parse fine in a worker (`colorBits.ts` is a pure parser, and
wiggle's colours are config slots, not theme reads — the theme-flip hazard was
imported from MAF by analogy). Multi-wiggle already ships `summaryScoreMode`
worker-side, so the whisker split is not blocked either. Only `rowIndex` is
genuinely main-thread-bound, and worse than stated: the ordered source list is
derived from the fetched data itself, so a fetch discovering a new source cannot
be told its own row assignment.

**The blocker nobody listed is retention.** Today the packed buffer is
transient — pack, upload, garbage. In the upload payload it is resident for the
life of the region, twice over (`mapUploadSync` also holds it, and payloads are
documented immutable so it cannot be nulled after upload). Wiggle's own comment
puts that at **82MB for a 1000-source multiwiggle at a 1Mb view**
(`wiggleInstanceBuffer.ts:33`). That is the decision, not a detail.

Note `installPerRegionLifecycle` is now `installUpload` (ADR-088); the no-RPC
re-encode on recolour, plot type, summary mode and re-sort is at
`installUpload.ts:188-206`, and the main-thread packer stays in full for it. So
this deletes no code, and its ~98ms is **~8ms per fetch round over ~11-12
rounds** — pacing, not throughput. Anyone selling it as "5.68s → 5.58s" is
quoting noise; it is verifiable only as a frame leaving the top-self list.

Order if taken: measure `pack` in isolation first (a whole-gesture A/B cannot
resolve it), settle retention, then write the plumbing.

## Smaller, measured, unclaimed

- **The profiled sweep may be the wrong regime.** `FloatingLabelsLayer`
  (`overlayElements.tsx:375`) rebuilds every gene label div per frame. At the
  harness's 0.5-4 bpPerPx that is nearly free; at 10-500, where people read gene
  tracks, it is plausibly the largest per-frame list in the app.
- **`legendRightEdgePx`** (`wiggleComponentUtils.ts:38`) consumes the whole
  `visibleRegions` array to produce what is usually the constant `totalWidth`,
  re-rendering both wiggle bodies every frame. Publishing the scalar stops it at
  the computed. Mechanically certain, under 20ms, invisible to the profiler —
  take it for the rule it states, not the win.
- **Three overlays set `ctx.font` ungated** —
  `drawVariantInsertionGlyphs.ts:147`, `drawMultiRowIndelGlyphs.ts:113`,
  `drawOffscreenMates.ts:763`. Same bug MAF already fixed. Hygiene only: per
  REJECTED_IDEAS they would win nothing, only change whose name is in the
  profile.
