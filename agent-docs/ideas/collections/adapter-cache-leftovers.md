---
name: adapter-cache-leftovers
description: "What the 2026-11-21 dataAdapterCache audit left open, none of it wrong data: claims nothing releases on worker drivers, tables totals counting the whole page cache, credential churn needing a generation number, an unmeasured config rehash, lane layers, nits."
---

# Adapter cache leftovers

The audit's two main-thread bugs are fixed (ADR-086, amended 2026-11-21), the
multi-row reference bug landed in `fd3f2e0e76`, and the tables trim, the type
half of the `adapterId` key, the unhandled eviction rejection and the
`clearAdapterCache` swap landed after it (`git log --grep="adapter cache" -i`).
None of what is left returns wrong data in the shipped app. A hand-set
`adapterId` reused over changed inline features still serves the first ones;
that is kept, and the FromConfig slot descriptions and the agent docs now say
to leave the slot unset.

## Higher

- **Claims nothing releases, on worker drivers.** `fetchSeq.ts` and LGV's
  `fetchSequence.ts` call under the literal `'getSequence'`, the
  `util/tracks.ts` prefetch claims for tracks that may never show, and
  `MafSequenceWidget` calls under the adapter's key with no retain. A
  main-thread driver now frees these at destroy; a worker driver keeps them
  until its workers end. One sequence adapter per assembly, so low cost.
- **The tables totals count the whole page cache.** `held().adapters` and
  `clear()`'s "empties every cache" include adapters another claim holds (a
  kept BAM's FASTA, a same-page browser's adapter), which tables alone no
  longer owns.

## Lower

- **An older-credential request replaces a newer instance** (`entryFor`).
  Reproduced: t1, t2, a late t1, t2 builds four instances. Churn, not a stuck
  state. A marker that refuses a credential seen before is wrong, because
  credentials carry no order: HTTP Basic's token is the same string each time
  the same password is typed, so right, wrong, right again would keep serving
  the wrong-password instance. A fix needs the internet account to stamp a
  rising generation into `internetAccountPreAuthorization`.
- **Credentials are `''` on the hand-set `adapterId` branch**
  (`adapterIdentity` in `dataAdapterCache.ts`), so a renewed credential never
  replaces an instance keyed by a hand-set id. In `@jbrowse/tables`, where no
  track close rebuilds an adapter, that instance keeps the old credential for
  as long as the trim keeps it.
- **An unstamped config is hashed again on every fetch**, in the cache key and
  in each fetch's region renaming (`renameRegions.ts` through
  `refNameMapKey.ts`), with no memo; `rpcSessionId` is cached only while
  observed. 6.5 ms per 10,000 inline features (`10d23810e8`), and the agent
  docs cap inline tracks at a few thousand. A WeakMap memo of
  `fingerprintAdapterConfig` per config object on the main thread would remove
  the repeats; nothing measures them as a cost yet. Read, not run.
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
