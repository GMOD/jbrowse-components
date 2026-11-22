---
name: adapter-cache-leftovers
description: "What a reviewed audit of dataAdapterCache still leaves open: inline features edited under a reused adapterId, claims nothing releases on worker drivers, the tables trim's weight total, credential churn that needs a generation number, lane layers and two nits."
---

# Adapter cache leftovers

The audit's two main-thread bugs are fixed (ADR-086, amended 2026-11-21), the
multi-row reference bug landed in `fd3f2e0e76`, and the tables trim, the type
half of the `adapterId` key, the unhandled eviction rejection and the
`clearAdapterCache` swap landed after it (`git log --grep="adapter cache" -i`).
None of what is left returns wrong data in the shipped app except the first,
and that one needs a hand-set id.

## Next

- **Inline `features` edited under a reused `adapterId` serve the old
  features.** The key is now `${type}:${adapterId}`, so two types no longer
  share an instance, but a notebook re-run that edits inline features under the
  same id (the `test_data/custom_sort/config.json` pattern) still gets the
  first instance, and credentials are `''` on that branch. The hand-set id is a
  documented contract: the FromConfig slot descriptions call it the cache key,
  `website/docs/agents_live_model.md` and `agents_recipes.md` tell an agent to
  change it when it recomputes features, and `readdedTrackConf.ts`'s error says
  the same. Needs a ruling between:
  - hashing every config once per snapshot object on the main thread (a
    WeakMap) and stamping it where `RpcMethodType` serializes configs, which
    makes the slot a no-op and touches the slot docs and both agent docs;
  - refusing a hand-set id at config load, a compat change;
  - keeping it as documented.
- **Claims nothing releases, on worker drivers.** `fetchSeq.ts` and LGV's
  `fetchSequence.ts` call under the literal `'getSequence'`, the
  `util/tracks.ts` prefetch claims for tracks that may never show, and
  `MafSequenceWidget` calls under the adapter's key with no retain. A
  main-thread driver now frees these at destroy; a worker driver keeps them
  until its workers end. One sequence adapter per assembly, so low cost.
- **The tables trim's weight total leaves out an adapter it declined but
  another claim still holds** (a kept BAM's FASTA, a same-page browser's
  adapter), and `trim` in `packages/tables/src/cache.ts` deletes that adapter's
  `wholeFileBytes` record, so asked for again it weighs `MIN_ADAPTER_BYTES`. A
  whole-file sequence adapter under a BAM is the case with real bytes. Not
  pruning `wholeFileBytes` in `trim`, only in `clear()`, is the cheap fix; read,
  not run. `held().adapters` and `clear()`'s "empties every cache" likewise
  count the whole page cache, which tables alone no longer owns.

## Lower

- **An older-credential request replaces a newer instance** (`entryFor`).
  Reproduced: t1, t2, a late t1, t2 builds four instances. Churn, not a stuck
  state. A marker that refuses a credential seen before is wrong, because
  credentials carry no order: HTTP Basic's token is the same string each time
  the same password is typed, so right, wrong, right again would keep serving
  the wrong-password instance. A fix needs the internet account to stamp a
  rising generation into `internetAccountPreAuthorization`.
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
- Nits: `releaseClaim` scans the whole cache per release (quadratic in a
  cascade); `getAdapter` returns the live `sessionIds` Set (removing it is a
  plugin-ABI change, `reference/PLUGIN_ABI_STABILITY.md`); an awaited eviction
  still passes a throwing `freeResources` up, so one in the tables trim replaces
  a successful call's result; the claim `'tables'` is a repeated literal the
  trim relies on matching.

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
