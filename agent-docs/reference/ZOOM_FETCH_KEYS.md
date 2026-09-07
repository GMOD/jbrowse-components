---
name: zoom-fetch-keys
description: How a per-region display says its cached data is stale under zoom — `zoomFetchKey` versus `regionHasData`, the four in-tree keys, a coarse tier as a second store, and `dataSuperseded`. Read before keying a fetch on zoom or adding a summary tier.
kind: spec
---

# Per-region zoom-staleness

All worker position output is **absolute genomic uint32**, so data stays valid
under zoom. The exceptions are for zoom-dependent *content*, not coords.

No display writes the cache predicate. `MultiRegionDisplayMixin` computes
`isCacheValid(idx)` from two terms: `regionHasData(idx)`, and whether the
`fetchInputs` stamped on that region still equal the current ones — the
settings tier (`rpcProps()` and the adapter config) and the zoom tier
(`zoomFetchArgs()`, or the `zoomFetchKey` string on a display not yet stating
its zoom inputs as an object) — the same three axes the global family's `currentFetchKey` carries, so a
settings change reads as stale through this compare and `SettingsInvalidate`
keeps the coverage map: the scrim comes from `staleSettingsDrawn`, which
compares the settings half alone and so stays down on a zoom.
`FetchVisibleRegions` calls it per region and refetches the ones that fail. A
display states its rule as two hooks, which are two different questions:

- **`zoomFetchKey`** (default `''`) — the zoom term of what a fetch issued
  *right now* would produce, as a string. `fetchRegions` reads the whole key in
  its synchronous prefix, before the RPC goes out, and stamps it beside the
  loaded region; a region whose stamp no longer matches is stale.
- **`regionHasData(idx)`** (default `true`) — whether the last fetch stored
  anything for this region, where "stored" and "marked loaded" can differ by
  design. A byte-gate refusal stamps nothing (`fetchRegions` and the fan-out
  helpers skip the commit for a refused result), so the fail-open default is
  unreachable from the gate; what keeps the default `true` is sequence's
  empty-result path, which stamps a legitimately empty region without storing —
  a store-derived default would refetch it forever.

Keeping them apart is what lets a display say "the data is fine, it just isn't
here" without inventing a key value for absence — a key that changed when data
arrived would be the `rpcProps()` loop in different clothes.

**`isCacheValid` is also a term of `dataCurrent`, which is the export gate and
not the scrim.** Spatial coverage answers "is the data here", never "is it what
a fetch now would bring back", so a zoom moving `fetchInputs` leaves every
held region covered and stale at once — and an export sampling `svgReady` across
the 600ms `FetchVisibleRegions` debounce plus the RPC painted wiggle's bins, the
variant matrix's columns and canvas's amino-acid wall as the previous zoom
computed them. Reusing the cache predicate rather than minting a second stamp
compare carries `regionHasData` along with it. A coarse tier answers the export
gate for itself while it stands in (`coarseTierSvgReady`): its own read, not the
detail store, so MAF's summary/detail flip inside a loaded region closes the
gate until the tier's read lands.

**The `isCacheValid` conjunct does not reach `displayPhase`, deliberately.**
`MultiRegionDisplayMixin` hands `foundationDisplayPhase` a
`viewportWithinLoadedData` thunk and reads `dataCurrent` nowhere, so the loading
scrim still stays down through a zoom inside the buffer. Folding staleness into
the phase is a different fold and still rejected: it raises the scrim 250 ms
into every zoom.

**That conjunct cannot latch, and the reason is structural rather than a case
list.** `planRegionFetch` refetches a block on
`!(isBlockCovered && isCacheValid)`, reading `isCacheValid` tracked on every
block it does not already owe a fetch for. So the key move that closes the
export gate is the same read, in the same dependency set, that wakes the refetch
reopening it. The `&&` short-circuits in front of it — a blocked byte gate, an
uncovered block — drop `isCacheValid`'s observables only where the block reaches
`fetchNeeded` regardless.

**Four declarations key on zoom:**

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one from
  `bpPerPx / resolution`, so the key is `String(view.bpPerPx)` and any zoom
  change refetches all visible regions together. See
  [ADR-008](../architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md).
  It sits on `WiggleCommonMixin`, the wiggle-shaped-*fetch* mixin, rather than
  on the `WiggleScoreConfigMixin` that mixin composes: the rule is about what a
  fetch returns, and `LinearManhattanDisplay` composes the score config alone
  while fetching untransformed SNPs.
- **Canvas** (`LinearBasicDisplay`): the amino-acid overlay is the only
  `bpPerPx`-dependent worker decision, so the key is that discrete threshold —
  `String(shouldRenderPeptideBackground(view.bpPerPx))` — and every other zoom
  change reuses the cached features. `laidOutDataMap` uses `coarseBpPerPx`
  (debounced 500ms) so Y-row packing doesn't recompute on every animation frame
  during smooth zoom.
- **Multi-sample variant matrix**: columns lay out by feature index across the
  visible width, so which features show is a function of the current zoom even
  when the viewport stays spatially inside loaded data. The key is
  `cellDataMode === 'matrix' ? String(bpPerPx) : ''` — wiggle's rule in matrix
  mode only, since the *regular* variant display draws each variant at its
  genomic position.
- **Alignments** (`LinearAlignmentsDisplay`): the two per-base colour schemes
  sample the wall at a sub-pixel bin, so what the worker's extract holds for a
  region is a function of zoom. The key is `String(perBaseBinBp)`, which is one
  constant string in every other colour scheme, and `perBaseBinBp` is
  `subPixelBinBp` over the **debounced** `coarseBpPerPx`. That same getter rides
  to the worker as a call-site RPC argument, so the key describes the fetch that
  was actually issued.

  Keying live `bpPerPx` instead would not be wrong for flipping more often: the
  quantization flips the bin once per octave either way, and wiggle keys on live
  `bpPerPx` outright. It is wrong because `FetchVisibleRegions` runs on the
  leading edge and then *throttles* at 600ms rather than settling. It runs while
  a gesture is still moving, and a live key hands each of those runs the bin of
  a zoom the gesture is only passing through. Every one of those mismatches
  refetches the one pipeline whose worker extract is the OOM the bin exists to
  bound, and latest-wins cancels the RPC, not extract work already running. The
  debounce costs no latency where a user would feel it, since every discrete
  placement flushes the coarse blocks itself (`settleCoarseBlocks`) and only the
  continuous zoom and drag paths wait out the 500ms.

**Two answer presence instead.** `LinearMultiRowFeatureDisplay` and canvas both
return `rpcDataMap.has(idx)` as deliberate defense-in-depth: a refused region is
never marked loaded on any current path, so these overrides decide which way a
future drift between the commit sites and the stores would fail — as a refetch,
not a freeze.

**A second tier is neither a key nor a presence answer: it is a second store
with its own span.** MAF zoomed out with a configured summary adapter pulls
cheap per-species summary rows, zoomed in the full alignment, and the density
band draws a sidecar's bins where the gate refuses the features. Both are
`CoarseTierMixin`: the tier's payloads live in `coarseTier` beside
`loadedRegions`, its read records the buffered span and key it was issued over
(`coarseTierRead`), and `coarseTierCovers` — the tier's `isBlockCovered` — decides
whether a viewport is still answered. The detail fetch is suspended while the
tier stands in, so `regionHasData`, `isCacheValid` and `zoomFetchKey` stay the
detail store's and never see the tier.

The span is why the tier cannot share the foundation's entry. A summary read
zoomed out covers a wide buffered span; the detail fetch that follows zoomed
in covers a narrow one, and one `loadedRegions` entry per `displayedRegionIndex`
stamped by both narrowed the summary's span to the detail's on every zoom in —
so zooming back out failed `isBlockCovered` about an octave later and re-read
the byte-gated summary adapter on a gesture the docs called free. A
`summary`/`detail` *key* would have been worse still: every zoom-out reads as
stale. `CoarseTierMixin.test.ts` pins that a narrow detail fetch leaves the
wide coarse read in place and the zoom back out re-reads nothing;
`LinearMafDisplay/summaryTierSwap.test.ts` seeds the two spans the way the two
fetches stamp them.

**A third hook sits beside those two and is not a cache question at all:
`dataSuperseded`** (default false). The cache hooks decide whether a region is
refetched. This one decides whether a settled fetch-input change is about to
invalidate what is held, which is an export-readiness question: it is the fourth
term of `dataCurrent`, beside spatial coverage, a non-empty `loadedRegions` and
`isCacheValid` per block, and `dataCurrent` is the freshness half of
`foundationSvgReady`. `GlobalFetchMixin` declares the same hook over its
signature compare — `dataCurrent` there is the stamped signature against the
live one, `&& !dataSuperseded`, and only the first term gates the fetch — so a
display with a dependent fetch of its own (multi-way synteny's lane genes) holds
the export without re-running its primary fetch.

The window `dataSuperseded` covers is invisible on screen, since the clear lands
a tick later and the loading scrim covers it, which is exactly why it needs
stating. `awaitSvgReady` samples freshness once, so an export sampling it inside
that window renders the data that is about to be discarded, or nothing at all
once the clear lands mid-render.

Every override in tree is a display invalidating its own load rather than the
viewport moving off it:

- **GWAS Manhattan**: adopting the top hit as the LD index SNP is an `rpcProps`
  write, so the load that produced the top hit is the load it invalidates.
- **Alignments**: the per-base bin, as one value compare —
  `perBaseBinBp !== livePerBaseBinBp`. Once the settled bin moves, the stamp
  stops matching `fetchInputs` and the foundation's `isCacheValid` term
  covers it. What no key can state is the 500ms `coarseBpPerPx` debounce ahead of
  it, where the settled bin has not moved yet, the clear is inevitable but not
  yet committed, and the wall on screen is already several octaves coarser than
  the zoom it is drawn at. That is the half an export lands in, since a reader
  zooms and then reaches for the menu.

**It fails hung, not stale**, the same trade `viewSignature` makes: a
supersession that latches true never lets `dataCurrent` go true again, and every
export of that display then waits out `awaitSvgReady`'s backstop instead of
failing. So a supersession compare states only the half it can prove, and leaves
key strings to the key.

**`zoomFetchKey` is a getter, so MST makes it a computed.** That is the point
— the observables it reads join `FetchVisibleRegions`' dependency set, where an
action's reads would be untracked and the autorun would keep a stale answer. The
cost runs the other way: a key that reads anything *non*-observable is memoized
for the display's life and never invalidates, so the display caches its first
fetch forever and nothing refetches it — a test knob behind the key has to be
a volatile, not a closure value (`perRegionTestEnv.ts`).
