---
name: one-path-byte-gate
description: The region-too-large gate has two measurement paths — a pre-flight CoreGetRegionByteEstimate round trip that five displays opt into, and the in-fetch check canvas folds into its own feature RPC — and the in-fetch one strictly dominates. What collapsing onto it deletes, the one "except" case (LD adapters serve no features), and why it is a product call before it is a refactor.
---

# One path through the byte gate

`RegionTooLargeMixin` answers "is this region too large" from one of two
measurements, and which one a display gets is a composition choice:

- **pre-flight** — `measuresBytesPreFlight` opts in, and `fetchRegions` /
  `runGlobalFetch` call `byteGateBlocksFetch`, a separate
  `CoreGetRegionByteEstimate` RPC over the whole region set with
  `scope: 'largestRegion'`, *before* any feature RPC goes out. Alignments, arc,
  MAF, the multi-sample variant base and LD.
- **in-fetch** — `measuresBytesInFetch` opts in, the feature RPC itself takes a
  `byteLimit`, runs `measureRegionBytes` as its first await, and answers a
  `RegionTooLargeResult` instead of a payload. Both canvas feature displays,
  through `CanvasFeatureGateMixin` and `fetchGatedRegions`.

Both land in the same place: `commitByteMeasurement` stamps the estimate, the
derived `regionTooLarge` reads it, and a blocked display keeps fetching once per
settled viewport so the banner releases on a fresh read
([REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md)).

## Why the in-fetch path dominates

- One round trip instead of two. The pre-flight RPC resolves the adapter, asks
  for the index estimate, returns, and then the feature RPC resolves the same
  adapter again.
- The adapter is already in hand for the density sample — canvas's
  `samplePreFetchDensity` runs on it between the byte stage and the full fetch,
  which the pre-flight shape cannot do at all.
- The refusal marker carries every measurement taken on the way to it
  (`bytes`, `featureCount`), so one result feeds both gate axes.
- The fan-out helpers already recognise the marker (`isRegionRefused`) and skip
  the commit, so a display on `fetchEachRegion` / `fetchRegionsBatched` gets
  the gate by passing `byteLimit` and nothing else.

## What collapsing deletes

`measuresBytesPreFlight`, `byteGateBlocksFetch` and its call in `fetchRegions`
and `runGlobalFetch`, the `gateSkipsMeasuredViewport` skip the installers apply
around it, the `CoreGetRegionByteEstimate` call site in
`perRegionTestEnv.ts`, and `gateEnabled` stops being the OR of two opt-ins.
`CanvasFeatureGateMixin.commitGateMeasurements` is the shape every display
would use — the byte half of it is already the base mixin's
`commitByteMeasurement`.

## What it costs

Five RPC executors grow the same first await canvas's has
(`executeRenderFeatureData.ts`: `measureRegionBytes`, return the marker when
over): the alignments feature fetch, `ArcGetFeatures`, MAF's detail and summary
tiers, `MultiSampleVariantGetCellData`, `RenderLDData`. Each display's
`fetchNeeded` passes `resolvedByteLimit()` and commits the measurement from the
result the way `fetchGatedRegions` does.

## The one "except"

LD's adapters (`PlinkLD*`) serve no features, so the pre-flight estimate over
them was always a measurement of nothing; `LDDisplay/shared.ts` records that
the opt-in "now has no except-when-the-adapter-would-explode clause". In-fetch,
the measurement moves to where the bytes are actually read, which is the
genotype adapter the LD RPC resolves — so this case gets *better*, but the
executor has to measure the right adapter, not `adapterConfig` by reflex.

## Why it is a product call first

The pre-flight measures the whole region set in one call and refuses the lot;
in-fetch refuses region by region. On a multi-region view where one region is
over budget and the others are not, the pre-flight blanks all of them under one
banner and in-fetch draws the small ones and banners the big one. That is
arguably the better behaviour, and it is canvas's today, but it is a visible
change for alignments and MAF and someone should look at it on a real track
before the old path is deleted.

Do this after the fetch helpers are the only way a display fetches (they are,
2026-08-23) and before anything else touches `RegionTooLargeMixin`: the mixin
is 1100 lines and about half of it is the path this removes.
