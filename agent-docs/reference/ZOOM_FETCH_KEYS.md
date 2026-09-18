---
name: zoom-fetch-keys
description: How a per-region display says its cached data is stale under zoom — `zoomFetchArgs` versus `regionHasData`, the adapter-declared `zoomRange` a payload carries, the three in-tree zoom rules, a coarse tier, and `dataSuperseded`. Read before keying a fetch on zoom or adding a summary tier.
kind: spec
---

# Per-region zoom-staleness

All worker position output is **absolute genomic uint32**, so data stays valid
under zoom. The exceptions are for zoom-dependent *content*, not coords.

No display writes the cache predicate. `MultiRegionDisplayMixin` computes
`isCacheValid(idx)` from two terms: `regionHasData(idx)`, and whether the
`fetchInputs` stamped on that region still equal the current ones — the
settings tier (`rpcProps()` and the adapter config) and the zoom tier (the
display's `zoomFetchArgs()` object) — the same three axes the global family's
`currentFetchKey` carries, so a settings change reads as stale through this compare and `SettingsInvalidate`
keeps the coverage map: the scrim comes from `staleSettingsDrawn`, which
compares the settings half alone and so stays down on a zoom.
`FetchVisibleRegions` calls it per region and refetches the ones that fail. A
display states its rule as two hooks, which are two different questions:

- **`zoomFetchArgs()`** (undeclared by default) — the zoom-derived arguments
  a fetch issued *right now* would send the worker, as the object the display
  spreads into its RPC. `fetchRegions` reads it in its synchronous prefix,
  before the RPC goes out, and stamps it beside the loaded region; a region
  whose stamp no longer matches is stale. A display whose worker reads no zoom
  leaves it undeclared, and its zoom tier never moves.
- **`regionHasData(idx)`** — whether what the last fetch stored for this
  region still answers at the view's `bpPerPx`. The default reads the store,
  and the payload's `zoomRange` where the adapter declared one
  (`BaseFeatureDataAdapter.getZoomRange`, ADR-125): a BigWig tier serves a band
  of zooms, and the region is stale once the view leaves it. A payload with no
  range answers at every zoom, so a display over an adapter that reads no zoom
  never refetches for one.

Keeping them apart keeps the stamp honest. A zoom rule that is no worker
input — a payload that answers only the zoom it was fetched at — is a
`regionHasData` answer; written as a fetch input it would stamp an argument the
worker never reads. And an input that changed when data arrived would be the
`rpcProps()` loop in different clothes.

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
block it does not already owe a fetch for. So the input move that closes the
export gate is the same read, in the same dependency set, that wakes the refetch
reopening it. The `&&` short-circuits in front of it — a blocked byte gate, an
uncovered block — drop `isCacheValid`'s observables only where the block reaches
`fetchNeeded` regardless.

**Wiggle and the mark display declare no zoom input: the adapter declares the
range.** BigWig has discrete zoom levels and bbi picks one from
`bpPerPx / resolution`, so the tier a fetch returns is a function of the zoom,
and only the adapter can see where the tiers sit. `BigWigAdapter.getZoomRange`
answers the bp/px interval its pick serves, the RPC writes it on the payload as
`zoomRange`, and the displays send the view's `bpPerPx` at the call site and
leave `zoomFetchArgs` alone. A zoom inside the tier refetches nothing; a zoom
across one refetches every visible region together. See
[ADR-125](../architecture-decision-records/adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md).

**Three displays state a zoom rule of their own:**

- **Canvas** (`LinearBasicDisplay`): two worker decisions depend on zoom, and
  `zoomFetchArgs()` sends both resolved rather than sending the zoom behind
  them — `peptides` (the amino-acid overlay is on and the view is at 1 bp/px or
  finer) and `geneGlyphMode` (`auto` collapses to one transcript past
  100 bp/px), with `expandedGeneIds` under `longestCoding`, the one mode the
  worker collapses in. The worker still gets `bpPerPx`, for the density gates
  alone, and every other zoom change reuses the cached features. Both
  thresholds read the **live** zoom. A term that flips only at a crossing costs
  a mid-gesture refetch only where the gesture crosses, and this extract is not
  the OOM that makes alignments settle first; off the debounced zoom, a region
  fetched in the mode the view just left read as current for 500ms, and an
  export in that window drew it. `laidOutDataMap` uses `coarseBpPerPx`
  (debounced 500ms) so Y-row packing doesn't recompute on every animation frame
  during smooth zoom.
- **Multi-sample variant matrix**: columns lay out by feature index across the
  visible width, and a matrix fetch asks for exactly the visible span, so after
  a zoom inside the loaded span the held payload still lays out features the
  view no longer shows. The RPC sends no zoom, so this is a `regionHasData`
  answer: the fetch records the `bpPerPx` it was issued at (`cellDataBpPerPx`),
  and the payload answers at that zoom alone. The *regular* variant display
  records none, since it draws each variant at its genomic position.
- **Alignments** (`LinearAlignmentsDisplay`): the two per-base colour schemes
  sample the wall at a sub-pixel bin, so what the worker's extract holds for a
  region is a function of zoom. `zoomFetchArgs()` carries `perBaseBinBp`, which
  is 1 in every other colour scheme and otherwise `subPixelBinBp` over the
  **debounced** `coarseBpPerPx`. The RPC spreads the same object, so the stamp
  describes the fetch that was actually issued.

  Resolving the bin off live `bpPerPx` instead would not be wrong for flipping
  more often: the quantization flips the bin once per octave either way. It is
  wrong because `FetchVisibleRegions` runs on the leading edge and then
  *throttles* at 600ms rather than settling. It runs while a gesture is still
  moving, and a live bin hands each of those runs the bin of a zoom the gesture
  is only passing through. Every one of those mismatches
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

**A second tier is neither a zoom input nor a presence answer: it is a second store
with its own span.** MAF zoomed out with a configured summary adapter pulls
cheap per-species summary rows, zoomed in the full alignment, and the density
band draws a sidecar's bins where the gate refuses the features. Both are
`CoarseTierMixin`: the tier's payloads live in `coarseTier` beside
`loadedRegions`, its read records the buffered span and key it was issued over
(`coarseTierRead`), and `coarseTierCovers` — the tier's `isBlockCovered` — decides
whether a viewport is still answered. The detail fetch is suspended while the
tier stands in, so `regionHasData`, `isCacheValid` and `zoomFetchArgs` stay the
detail store's and never see the tier.

The span is why the tier cannot share the foundation's entry. A summary read
zoomed out covers a wide buffered span; the detail fetch that follows zoomed
in covers a narrow one, and one `loadedRegions` entry per `displayedRegionIndex`
stamped by both narrowed the summary's span to the detail's on every zoom in —
so zooming back out failed `isBlockCovered` about an octave later and re-read
the byte-gated summary adapter on a gesture the docs called free. A
`summary`/`detail` zoom input would have been worse still: every zoom-out reads
as stale. `CoarseTierMixin.test.ts` pins that a narrow detail fetch leaves the
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
  covers it. What no stamp can state is the 500ms `coarseBpPerPx` debounce ahead of
  it, where the settled bin has not moved yet, the clear is inevitable but not
  yet committed, and the wall on screen is already several octaves coarser than
  the zoom it is drawn at. That is the half an export lands in, since a reader
  zooms and then reaches for the menu.

**It fails hung, not stale**, the same trade `viewSignature` makes: a
supersession that latches true never lets `dataCurrent` go true again, and every
export of that display then waits out `awaitSvgReady`'s backstop instead of
failing. So a supersession compare states only the half it can prove, and leaves
the stamp compare to the foundation.

**`zoomFetchArgs` is read inside a computed.** That is the point — the
observables it reads join `FetchVisibleRegions`' dependency set, which is why it
is declared in `.views()`: an action's reads would be untracked and the autorun
would keep a stale answer, and `no-restricted-syntax` refuses the declaration.
The cost runs the other way: args that read anything *non*-observable are
memoized for the display's life and never invalidate, so the display caches its
first fetch forever and nothing refetches it — a test knob behind the args has
to be a volatile, not a closure value (`perRegionTestEnv.ts`).
