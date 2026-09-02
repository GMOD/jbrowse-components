---
name: settings-axis-into-region-fetch-key
description: The per-region family invalidates a settings change with a synchronous clearAllRpcData() while the global family folds the same rpcPropsCacheKey into its freshness key and keeps stale data on screen through the refetch. Folding the settings axis into the default regionFetchKey would make the two families agree and give per-region the keep-stale behaviour ADR-006 asks for, and deletes SettingsInvalidate — but clearAllRpcData's cancel-and-clear-error half needs a new home first.
---

# The settings axis is one key on the global family and a clear on the per-region one

Every fetch in the tree gates on one compare: the key the held data was fetched
under against the key a fetch now would use (`installFetch`'s `fetchKey` /
`heldAnswers`). The two LGV families spell their non-viewport axes differently:

- **Global**: `GlobalFetchMixin.currentFetchKey` is
  `viewSignature | rpcPropsCacheKey | adapterConfigKey`. A settings change moves
  the key, the skeleton refetches, and the display keeps the stale frame up
  under the loading overlay until the commit lands.
- **Per-region**: `regionFetchKey` (default `''`, overridden by four displays
  for a zoom-dependent worker decision) carries no settings term. The settings
  and adapter axes are watched by a separate autorun, `SettingsInvalidate`,
  which calls `clearAllRpcData()` — cancel the fetch, clear the error, drop
  every loaded region — and the plan then finds nothing covered and refetches
  onto a blank display.

ADR-006 chose keep-stale-through-refetch for viewport-agnostic displays, and the
global family has it structurally. The per-region family has it only for the
axes a display puts in `regionFetchKey`, and gets a blank on every other.

## The fold

Make the mixin's default `regionFetchKey` the settings axis —
`${rpcPropsCacheKey}|${adapterConfigKey}` — and have a display's override
*extend* it rather than replace it (the four overrides return one term today;
they would return `${super}|${term}`, or the mixin would compose the two
halves itself and rename the hook to the display's term). Then a settings
change makes every loaded region read `!isCacheValid` on the next plan run,
which is a refetch with the stale data still drawn, and `SettingsInvalidate`
goes.

## What stops it being a one-line change

- **`clearAllRpcData` does three things and only one of them is the clear.**
  It cancels the in-flight fetch and clears `error` / `fetchCanceled` too. A key
  move cancels nothing — the superseding fetch does that through the rotation —
  but the error clear is what lets a settings change recover a display from a
  failed fetch without Retry. That recovery would need to move to the plan (an
  errored plan is `idle: blocked` today) or be given up.
- **`makeSettingsLoopGuard` becomes the async loop trap instead.** The guard
  catches an `rpcProps()` that returns fetch-derived state because the clear
  re-fires synchronously. As a key term the same mistake loops on the fetch
  cadence, which is the global family's documented hazard
  (`installGlobalFetchAutorun`, "`rpcProps()` loop hazard") and has no guard.
- **Two suites pin the blank.** `zoomInvalidation.test.ts` and the canvas
  `fetchAutorun.test.ts` assert what a settings change clears; both would move
  to asserting a refetch over held data.
- **ADR-003's viewport-baked displays.** ADR-006 kept clearing for displays
  whose payload bakes the viewport in. Those would need to opt back into the
  clear, or their `regionFetchKey` would need the viewport term that makes
  stale data unreachable.

`discrete-zoom-thresholds-in-rpc-props` is the adjacent entry: two displays put
a zoom tier in `rpcProps()` and pay the full clear for it. Taking this fold
first would make that one a no-op — the tier would already be a key term.
