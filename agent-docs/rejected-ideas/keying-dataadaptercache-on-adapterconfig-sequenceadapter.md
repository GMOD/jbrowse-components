---
name: keying-dataadaptercache-on-adapterconfig-sequenceadapter
description: Keying `dataAdapterCache` on `(adapterConfig, sequenceAdapter)`
area: config-and-mst
---

# Keying `dataAdapterCache` on `(adapterConfig, sequenceAdapter)`

proposed
twice as the fix for `setSequenceAdapterConfig` being set-once, so that an
adapter config displayed against two assemblies gets one instance per
reference instead of taking whichever call primed it first. Costed 2026-08-19
and declined: **7 of the 14 `getAdapter` call sites pass no sequence adapter
at all** — `CoreGetSequence`, `CoreGetInfo`, `CoreGetMetadata`,
`CoreGetRegions`, `CoreGetRegionByteEstimate`, plus the hic, maf, variants and
gwas RPCs — because they have no assembly context and legitimately don't want
one. Under a compound key each of those forks a *second* instance of the same
file: `CoreGetRegionByteEstimate` runs on every fetch as the byte gate, so a
BAM would carry two adapters and two index downloads for the whole session.

The problem it solves is also smaller than it looks. `renameRegionsIfNeeded`
resolves one refName map per unique assembly through `Promise.all`, so a
multi-assembly fetch can prime one instance twice with two different configs —
but the adapters fetched that way are the comparative ones (PAF, chain,
dotplot), and none of them ever reads `sequenceAdapterConfig`. No adapter that
reads the reference is fetched across two assemblies. Making the conflict
loud instead was costed and declined with it: it would throw on the
comparative path, which is doing nothing wrong.
