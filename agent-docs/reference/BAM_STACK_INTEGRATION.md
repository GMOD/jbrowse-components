---
name: bam-stack-integration
description: Which BAM-stack integrations are deliberate non-integrations, and which read-path seams were measured and declined? Read before adding a BAM read-path optimization.
audience: internal
kind: measurement
---

# The BAM stack, layer by layer

Three repos serve one BAM query: `BamAdapter` (`plugins/alignments`), `@gmod/bam`,
`@gmod/bgzf-filehandle` over `@gmod/range-cache-filehandle`. Each is optimized
against its own measurements, and most apparent gaps between them already exist
one layer down under another name. BGZF inflate is the largest line of a query;
## The deliberate non-integrations

Do not "fix" these.

- **`fetchReferenceSequence` / `setReference`.** `setReference` needs a region
  covering the whole read (`@gmod/bam` ADR 0020) because records are shared
  between queries (ADR 0006). `BamAdapter` uses `seqFetchSpan` + `packReference`
  + `withRegionRef`, clamped to the viewport so a chromosome-length read does not
  drag a chromosome of sequence in. `regionRefAliasing.test.ts` pins the
  `RegionBoundBamFeature` view.
- **`viewAsPairs` / `pairAcrossChr`.** This repo chains in `filterChainFeatures`
  (worker) and `attachChainFields` (main thread). `@gmod/bam` ADR 0003 rejected
  memoizing `get name` on the premise that `fetchPairs` is the only repeat
  caller, so that premise depends on the option staying unused.
## Seam 2 — the chunk cache key slides as a query pans

`@gmod/bam` keys its parsed-chunk cache on the merged chunk's virtual-offset
span, and the merge is query-dependent, so two pans over the same bytes parse
them twice (`@gmod/bam` ADR 0019 measures and parks it). The cache is perfect
for a repeated query and collapses once the window moves at all, even for
non-overlapping windows. `benches/panRedundancy.probe.ts` counts it; quote the
moderate-depth regime, where the saving lives. CRAM is near 0% because
`@gmod/cram` keys on a slice fixed at write time.

**Serving a subset chunk out of a cached superset looks like a local fix and
silently returns duplicated reads.** Read ADR 0019 before touching
`chunkCacheKey`.

## Seam 4 — the SA lookup never joined the MM/Mm one

**Do not add the API on these numbers**: the saving is ~12ms on the deepest
fixture against an API every consumer carries. A real implementation belongs
inside `BamRecord` as an argument-count change to the shared `tagValueEnd`
cursor, not a fourth walk.

- **`seq` is decoded twice per read in modification color modes, and the obvious
  fix does not pay**: reading `NUMERIC_SEQ` nibbles measures at parity. What
  remains is sharing one decoded string between consumers in different phases of
  `executeRenderAlignmentData`.
