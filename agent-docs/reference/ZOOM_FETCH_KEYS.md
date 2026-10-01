---
name: zoom-fetch-keys
description: How a per-region display says its cached data is stale under zoom — `zoomFetchArgs` versus `regionHasData`, the adapter-declared `zoomRange` a payload carries, the three in-tree zoom rules, a coarse tier, and `dataSuperseded`. Read before keying a fetch on zoom or adding a summary tier.
kind: spec
---

# Per-region zoom-staleness

Worker position output is absolute genomic uint32, so coordinates stay valid
under zoom. Staleness under zoom is about zoom-dependent *content*.

No display writes the cache predicate. `MultiRegionDisplayMixin` computes
`isCacheValid(idx)` as `regionHasData(idx)` and the `fetchInputs` stamped on
that region still equalling the current ones — the settings tier (`rpcProps()`
and the adapter config) and the zoom tier (`zoomFetchArgs()`).
`FetchVisibleRegions` refetches every region that fails. The loading scrim
comes from `staleSettingsDrawn`, which compares the settings half alone, so it
stays down on a zoom.

A display states its zoom rule through two hooks that answer different
questions:

- **`zoomFetchArgs()`** (undeclared by default) — the zoom-derived arguments a
  fetch issued now would send the worker, as the object the display spreads into
  its RPC. `fetchRegions` reads it before the RPC goes out and stamps it beside
  the region. A display whose worker reads no zoom leaves it undeclared.
- **`regionHasData(idx)`** — whether the stored payload still answers at the
  view's `bpPerPx`. The default reads the store and the payload's `zoomRange`
  where the adapter declared one (`BaseFeatureDataAdapter.getZoomRange`); a
  payload with no range answers at every zoom.

Keep them apart. A rule that is no worker input belongs in `regionHasData`;
written as a fetch input it stamps an argument the worker never reads. An input
that changes when data arrives is the `rpcProps()` loop again (FETCH_KEYS.md).

## Export gate, not scrim

`isCacheValid` is a term of `dataCurrent`, the freshness half of
`foundationSvgReady`. Spatial coverage alone cannot see a zoom that moved
`fetchInputs`, so without the term an export inside the `FetchVisibleRegions`
throttle draws the previous zoom's bins, columns or amino acids. A coarse tier
answers the gate for itself while it stands in (`coarseTierSvgReady`).

`displayPhase` does not read `dataCurrent`: `MultiRegionDisplayMixin` hands
`foundationDisplayPhase` a `viewportWithinLoadedData` thunk instead. Folding
staleness into the phase raises the scrim into every zoom — declined.

The term cannot latch. `planRegionFetch` refetches a block on
`!(isBlockCovered && isCacheValid)`, so the input move that closes the export
gate is the same tracked read that wakes the refetch reopening it.

## The in-tree zoom rules

**Wiggle and the mark display: the adapter declares the range.**
`BigWigAdapter.getZoomRange` answers the bp/px interval its tier pick serves,
the RPC writes it on the payload as `zoomRange`, and the displays leave
`zoomFetchArgs` alone. A zoom inside the tier refetches nothing; one across it
refetches every visible region together.
[ADR-125](../architecture-decision-records/adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md).

**Canvas** (`LinearBasicDisplay`): `zoomFetchArgs()` sends the two zoom-driven
worker decisions resolved — `peptides` and `geneGlyphMode` (plus
`expandedGeneIds` under `longestCoding`) — rather than the zoom behind them, so
every other zoom change reuses cached features. Both thresholds read the
**live** zoom: off the debounced one, a region fetched in the mode the view just
left reads as current for the debounce, and an export in that window draws it.
`laidOutDataMap` packs rows off `coarseBpPerPx` so packing does not rerun every
frame.

**Multi-sample variant matrix**: columns lay out by feature index across exactly
the visible span the fetch asked for, so the payload answers only the zoom it
was fetched at. The RPC sends no zoom, so this is a `regionHasData` answer over
`cellDataBpPerPx`. The regular variant display draws at genomic positions and
records none.

**Alignments** (`LinearAlignmentsDisplay`): `zoomFetchArgs()` carries
`perBaseBinBp`, resolved off the **debounced** `coarseBpPerPx`, and the RPC
spreads the same object. PER_BASE_SUBPIXEL_BIN.md owns why the live zoom is
wrong there.

**Presence-only answers.** `LinearBasicDisplay` takes the mixin's
`regionHasData`. `LinearMultiRowFeatureDisplay` returns `regionHasPinnedData`,
which asks for a payload whose partition field matches the pin.

## A coarse tier is a second store with its own span

MAF's summary rows and the density band's sidecar bins are `CoarseTierMixin`:
the tier's payloads live in `coarseTier` beside `loadedRegions`, its read
records the buffered span and key it covered (`coarseTierRead`), and
`coarseTierCovers` decides whether a viewport is still answered. The detail
fetch is suspended while the tier stands in, so `regionHasData`, `isCacheValid`
and `zoomFetchArgs` stay the detail store's.

The tier cannot share the foundation's `loadedRegions` entry: a narrow detail
fetch stamped over the wide summary read narrows its span, and zooming back out
re-reads the byte-gated summary adapter. A `summary`/`detail` zoom input is
worse — every zoom-out reads as stale. `CoarseTierMixin.test.ts` and
`LinearMafDisplay/summaryTierSwap.test.ts` pin both.

## `dataSuperseded`

`dataSuperseded` (default false) is an export-readiness question, not a cache
one: true when a settled fetch-input change is about to invalidate what is held.
It is the last term of `dataCurrent`. The window is invisible on screen — the
clear lands a tick later under the scrim — but `awaitSvgReady` samples freshness
once, so an export inside it renders data about to be discarded.
`GlobalFetchMixin` declares the same hook over its signature compare, so a
display with a dependent fetch (multi-way synteny's lane genes) holds the export
without re-running its primary fetch.

Every in-tree override is a display invalidating its own load:

- **GWAS Manhattan**: adopting the top hit as the LD index SNP is an `rpcProps`
  write, invalidating the load that produced the hit.
- **Alignments**: `perBaseBinBp !== livePerBaseBinBp`, covering the
  `coarseBpPerPx` debounce, before the settled bin moves and the stamp compare
  takes over.

**It fails hung, not stale.** A supersession that latches true never lets
`dataCurrent` go true, and every export waits out `awaitSvgReady`'s backstop. So
an override states only the live-vs-settled half, as a value compare, and
leaves the stamp compare to the foundation.

## `zoomFetchArgs` is read inside a computed

Its observables join `FetchVisibleRegions`' dependency set, which is why it is
declared in `.views()` (`no-restricted-syntax` refuses it as an action). Args
that read anything non-observable are memoized for the display's life, so the
first fetch is cached forever — a test knob behind the args has to be a
volatile, not a closure value (`perRegionTestEnv.ts`).
