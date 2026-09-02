---
name: settings-axis-into-region-fetch-key
description: The settings and adapter axes are in the per-region fetch key now, so a settings change reads as stale through isCacheValid like a zoom does — but SettingsInvalidate still runs clearAllRpcData() beside it, blanking every display but canvas. Retiring that clear is per display: replace the map clear with canvas's prune-in-fetchNeeded, and give displayPhase a term for "stale but drawn" so the scrim does not vanish with the coverage map.
---

# The clear beside the key

`MultiRegionDisplayMixin.regionFetchKey` is
`rpcPropsCacheKey | adapterConfigKey | zoomFetchKey` (2026-09), the same three
axes the global family's `currentFetchKey` carries. A settings change therefore
makes every loaded region read `!isCacheValid` on the next plan run, the export
gate closes through `dataCurrent`, and the plan would refetch on its own with
the stale data still drawn — which is what the global family does, and what
ADR-006 asked for.

`SettingsInvalidate` still calls `clearAllRpcData()` on the same trigger, and
the reasons it still has to are what this entry is about.

## What the clear does that the key does not

- **Supersedes the in-flight fetch now.** The plan answers `inFlight` while
  `isLoading`, so without the cancel a settings change during a slow fetch
  waits for the old payload to land (stamped stale, then refetched). Canvas's
  `fetchAutorun.test.ts` pins the immediate supersede.
- **Unblocks an errored display.** `error` / `fetchCanceled` make the plan
  `idle: blocked`; the clear drops both, so a settings change recovers a failed
  display without Retry.
- **Drops the display's own maps.** Seven displays override
  `clearDisplaySpecificData` to empty their `rpcDataMap` (wiggle, alignments,
  MAF, multi-row canvas, gwas, sequence, the variant cell payload). Canvas's
  `LinearBasicDisplay` made it a no-op under ADR-006 and prunes off-screen
  regions in `fetchNeeded` instead.
- **Empties the coverage map**, which is the only reason `displayPhase` goes
  `loading`: the phase reads `viewportWithinLoadedData`, deliberately not
  `isCacheValid` (REJECTED_IDEAS.md §"Folding content staleness into
  `displayPhase`"). Keep `loadedRegions` and a display that also blanks its
  map shows an empty track with no scrim until the refetch lands.

## The fold, per display

Retiring the clear is one display at a time, and each step is the same shape:

- replace the `clearDisplaySpecificData` map clear with a prune in
  `fetchNeeded`, so the payload survives under the new settings until its
  replacement lands (only right where drawing stale data under the new setting
  is honest: a colour or filter change, yes; the variant row set, probably not);
- keep the supersede and the unblock — a narrower action than
  `clearAllRpcData`, without `loadedRegions.clear()`;
- decide what the phase shows: nothing (the global family's answer — the
  `isLoading` window and the corner chip) or a "stale but drawn" term
  `computeLoadingTerm` does not have today.

`makeSettingsLoopGuard` catches the synchronous loop the clear creates when
`rpcProps()` returns fetch-derived state; without the clear the same mistake
loops on the fetch cadence, which is the global family's documented hazard and
has no guard.

`discrete-zoom-thresholds-in-rpc-props` is the adjacent entry: two displays put
a zoom tier in `rpcProps()` and pay this clear for it.
