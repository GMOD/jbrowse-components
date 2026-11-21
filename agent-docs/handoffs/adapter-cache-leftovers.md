---
name: adapter-cache-leftovers
description: "What a reviewed audit of dataAdapterCache left open after per-driver claim namespaces landed: adapterId keying that serves stale features, claims nothing releases, @jbrowse/tables trimming, credential churn, lane layers and nits."
---

# Adapter cache leftovers

The audit's two main-thread bugs are fixed (ADR-086, amended 2026-11-21), and
the multi-row reference bug landed in `fd3f2e0e76`. None of these return wrong
data in the shipped app except the first, and that one needs a hand-set id.

## Next

- **A hand-set `adapterId` replaces the content hash.** `adapterIdentity` in
  `dataAdapterCache.ts` keys on the string alone, so two configs sharing one,
  with different types or inline `features`, share one instance and one shows
  the other's features. A notebook re-run that edits inline features under the
  same id (the `test_data/custom_sort/config.json` pattern) does it.
  Credentials are also `''` there. `withAdapterId` exists so a huge inline
  config is not hashed on every call, so keying on a hash of the features
  undoes it; keying on `${type}:${adapterId}` fixes only the type half.
  Options: stamp the id at config load and refuse a user-set one, or hash the
  features once per config object on the main thread.
- **Claims nothing releases, on worker drivers.** `fetchSeq.ts` and LGV's
  `fetchSequence.ts` call under the literal `'getSequence'`, the
  `util/tracks.ts` prefetch claims for tracks that may never show, and
  `MafSequenceWidget` calls under the adapter's key with no retain. A
  main-thread driver now frees these at destroy; a worker driver keeps them
  until its workers end. One sequence adapter per assembly, so low cost.
- **`@jbrowse/tables` `keepAdapters` evicts by recency alone.** A BAM asks for
  its FASTA once (`getSequenceAdapter` is a cached setup), so the FASTA's
  `lastRequest` goes stale and a trim frees it while the BAM holds it; the next
  reader builds a second. It also evicts a same-page engine's adapters, since
  it ignores whose claims hold an entry. Fix: skip entries a live owner's claim
  holds, or bump a sub-adapter's `lastRequest` with its parent's.

## Lower

- **An older-credential request replaces a newer instance** (`entryFor`).
  OAuth only: an old-token call arriving after a renewal rebuilds the adapter
  and evicts the sub-adapters only it held; the next new-token call rebuilds
  again. Churn, not a stuck state. A per-entry "credentials seen at" marker
  that refuses a downgrade would stop it.
- **Sub-adapters built for an evicted parent never get `freeResources`**
  (`unclaimedAdapter`), so their decoded-bytes charge waits for GC, the failure
  `freeAdapterResources`' comment names. The window is one request outliving
  its track.
- **Lane layers.** `laneLayerTemplates` (`MultiWaySyntenyDisplay/model.ts`)
  admits any `READS_REFERENCE` adapter as a per-lane template, reading it as
  "computes from the reference". That admits BAM and CRAM, and since
  `fd3f2e0e76` a `MultiWiggleAdapter`, whose bigWig members would be read on
  every lane's genome. No config does either; the slot's description names
  adapters that compute from the sequence. Kept as is.
- Nits: `void evict(...)` is an unhandled rejection if `freeResources` throws;
  `releaseClaim` scans the whole cache per release (quadratic in a cascade);
  `clearAdapterCache` swaps the map without marking old owners evicted;
  `getAdapter` returns the live `sessionIds` Set (removing it is a plugin-ABI
  change, `reference/PLUGIN_ABI_STABILITY.md`).

## Settled; don't re-propose

- **A cache per driver or per plugin manager** instead of claim namespaces.
  `getAdapter`, `keepAdapters`, `cachedAdapterCount` and `clearAdapterCache`
  take no driver, GC reclaim skips `freeResources`, and each jb2export batch
  record has its own plugin manager, which would undo `d0ae99f72e`'s adapter
  reuse across records.
- **Releasing claims before `rpcManager.destroy()`.** ADR-069 keeps the
  disposers a task later, it covers only counted claims, and engines sharing
  one namespace would still evict each other.
- **Namespacing in `RpcManager.call`.** A call made while serializing reuses
  `args.sessionId`; see the ADR-086 amendment.
