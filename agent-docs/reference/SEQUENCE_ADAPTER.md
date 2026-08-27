---
name: sequence-adapter
description: How the assembly's sequence adapter config reaches a BAM/CRAM adapter — derived by renameRegionsIfNeeded rather than passed, stashed set-once on the instance, with CoreGetRefNames the one caller that still supplies its own. Read before adding an RPC that decodes against the reference.
audience: internal
---

# The sequence adapter is derived, not passed

BAM/CRAM decode against the reference (CRAM to reconstruct bases, BAM to compute
mismatches without an MD tag), but a track's adapter config doesn't carry the
reference — it belongs to the assembly. So the assembly's sequence adapter config
rides **alongside** `adapterConfig` as a sibling RPC arg, never spliced into it,
and is stashed on the resolved adapter instance by `setSequenceAdapterConfig`;
the adapter lazily builds it through `getSubAdapter` on first
`getSequenceAdapter()`. `CramAdapter` binds its `seqFetch` into the
`IndexedCramFile` at construction, which is why the config lives on the instance
rather than travelling per call.

**No caller passes it.** `renameRegionsIfNeeded` already resolves the assembly a
fetch is against — the same handle `originalRefName` is a name into — so it
supplies the config, and every renaming RPC gets one for free. That makes it a
property of the *call* rather than of any method's payload, like `sessionId` and
the handles; `RpcRegistry` documents why that distinction is worth keeping.

It was a rule until 2026-08-19, and the rule did not hold: `CoreGetExportData`,
`BreakpointGetFeatures` and `fetchTrackData`'s `CoreGetFeatures` all omitted it
and worked only because `CoreGetRefNames` had primed the instance first.
Forgetting was silent — a CRAM throws mid-decode, a BAM just reports no
mismatches — so deriving it beats documenting it.

`CoreGetRefNames` is the one exception and still passes its own, because it is
what renaming CALLS and cannot be fed by it. Its priming is not vestigial: a
`ReferenceScanAdapter` resolves its sequence *inside its own `getRefNames`*, so
that call must arrive already primed. What no longer holds is any LATER call
depending on it — delete the priming outright and `SaveTrackData`'s CRAM case
stays green, where it used to be the only test in the repo that saw it.

Two tests hold this down. `data_adapters/sequenceAdapterPriming.test.ts` pins
the priming contract directly — prime through `CoreGetRefNames`, fetch with
nothing, read the reference back — and the alignments adapters' own suites (20
tests over 10 files) pin the consumer half, that an adapter uses the config it
was handed.

`setSequenceAdapterConfig` is set-once: one `??=`, which both refuses to clear
the field and refuses to replace it. A multi-assembly fetch can therefore prime
one instance twice with two different configs, and the first wins. That is
harmless rather than fixed — the adapters fetched across two assemblies are the
comparative ones, which never read the field. Both the compound cache key and a
loud conflict were costed and declined; see
[REJECTED_IDEAS.md](REJECTED_IDEAS.md).
