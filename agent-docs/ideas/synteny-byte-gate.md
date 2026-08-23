---
name: synteny-byte-gate
description: LGVSyntenyDisplay inherits the byte-gate opt-in from LinearAlignmentsDisplay but no comparative adapter implements getRegionByteSize, so the gate is inert and a fine-tier PIF over a whole chromosome downloads unbounded. The estimate is one bytesForRegions call on the indexed PAF adapters; what parks this is the budget decision, which has to come from SYNTENY_LOD's measured wire sizes rather than the base 1 Mb.
---

# Make LGVSyntenyDisplay's inherited byte gate live

## The state today

`LGVSyntenyDisplay` extends `LinearAlignmentsDisplay` wholesale, which brings
`measuresBytesPreFlight = true` — so every fetch already pays the
`CoreGetRegionByteEstimate` RPC. But no adapter in
`plugins/comparative-adapters` implements `getRegionByteSize`, so the estimate
comes back `undefined` and the gate never fires: no banner, no cap, and a
fine-tier `.pif.gz` over a whole chromosome downloads whatever it holds. The
pre-flight round trip is paid for nothing.

Recorded as a decision (inert, known) in
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md) §"Two ungated shapes
that are decisions, not omissions".

## The cheap half

`PifFile` is `TabixIndexedFile`-backed, so the estimate is the same one-liner
`BedTabixAdapter` already ships (`bytesForRegions` off the index) on
`PairwiseIndexedPAFAdapter` / `AllVsAllIndexedPAFAdapter`. The moment it lands,
`check-gated-adapter-budgets.ts` (whose scan now walks `extends` chains) fails
until the budget is written into `gatedAdapterBudgets.json` — which is the
point: the budget is the real work here, not the method.

## The parked half: which budget

The base display tier is 1 Mb, and SYNTENY_LOD's measured wire sizes say a
legitimate whole-genome coarse-tier fetch is MB-scale — so the base budget
banners the display's ordinary use. The decision needs:

- a `fetchSizeLimit` slot on the indexed PAF adapters (or the display) sized
  from SYNTENY_LOD's cost model, generous enough that the coarse tier never
  banners and the fine tier banners only where the parse would genuinely stall;
- a check that the tier flip (10,000 bp/px) and the budget agree — the gate
  must not banner a span whose coarse tier would have been cheap, which is
  adjacent to
  [single-tier-pif-refetches-at-the-threshold](single-tier-pif-refetches-at-the-threshold.md);
- the `byteGateAdapterConfig` question: `LGVSyntenyDisplay` reads different
  tiers at different zooms, so the estimate should measure the tier the fetch
  would actually read, which is what that hook exists for (MAF is the worked
  example).

## Also in scope when picked up

The plain `LinearSyntenyDisplay` / dotplot fetches read the same files with no
gate at all (ADR-054 family, no `RegionTooLargeMixin`); whether they want one is
a separate question — their LOD tiering already bounds the common case, which
is why this file is only about the LGV-hosted display where the opt-in is
already composed and silently inert.
