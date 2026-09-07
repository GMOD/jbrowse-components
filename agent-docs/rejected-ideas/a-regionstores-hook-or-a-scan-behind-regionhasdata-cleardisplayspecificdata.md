---
name: a-regionstores-hook-or-a-scan-behind-regionhasdata-cleardisplayspecificdata
description: A `regionStores` hook (or a scan) behind `regionHasData` / `clearDisplaySpecificData`
area: config-and-mst
---

# A `regionStores` hook (or a scan) behind `regionHasData` / `clearDisplaySpecificData`

parked 2026-08-20 as
`ideas/per-region-stores-are-named-four-times.md`, closed 2026-08-21 by
answering the question it parked on: the fail-open `regionHasData` default is
**unreachable** from the byte gate. A refusal stamps nothing — the
`fetchEachRegion` family skips refused results outright — pinned by
`fetchRegions.test.ts` and
`LinearBasicDisplay/loadedRegionCoverage.test.ts`. The one stamp-without-store
path is sequence's legitimately-empty-region answer, where fail-open is
load-bearing — a store-derived default would refetch an empty region forever.
So `regionHasData` is deliberate defense-in-depth (the two canvas
`rpcDataMap.has` overrides, which decide which way a future commit/store
drift fails), its default is right, and there is nothing for a hook or a
scan to fix. MAF's tier-selection override is gone with the tier's own
store (`CoarseTierMixin`). The scan variant was also a check
that cannot fail (`mechanisms/green-checks-that-cannot-fail.md`).
