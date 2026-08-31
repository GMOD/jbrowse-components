---
name: fetch-skeleton
description: The one latest-wins fetch machine every fetch in the tree runs on — `installFetch` / `runFetchOnce`, the token rotation, the phase contract, the error rule — and the test for which of an autorun's reads are tracked. Read before writing a fetch installer or reaching for `untracked`.
audience: internal
---

# The fetch skeleton

## One latest-wins machine, one phase contract, one skeleton

**begin → clear the error → run → commit if still current → `handleFetchError`
→ end.** That sequence was written five times — `FetchMixin.runFetch`, the
prerequisite skeleton, the comparative installer, chord's fetch, the breakpoint
overlay fetch — and each copy was missing a different rule: no rotation at all,
an error publish guarded on liveness but not currency, no clear at the start, a
`finally` that stranded the loading flag on an abort. It is
`runFetchOnce` (`@jbrowse/core/util/installFetch`) now, and `installFetch` is
that plus the autorun over it: the rotation, the leading edge, the unconditional
`reloadCounter` read, the durable cancel gate, and the two dev-only contract
checks (`assertDisplayContract`, `makeRetryContractCheck`), which chord and the
breakpoint fetch had never had.

The pieces underneath it, and who reaches them directly:

| what | where | who runs on it |
| --- | --- | --- |
| the whole sequence above, plus the autorun over it | `installFetch` / `runFetchOnce` | every fetch — `FetchMixin.runFetch` holds `runFetchOnce` for the per-region family (it needs the MST flow, since its trigger is `planRegionFetch`'s autorun), and everything else takes the installer: the global family (`installGlobalFetchAutorun` lends `FetchMixin`'s rotation through the `rotation` option, so `cancelFetch` reaches the fetch it installs), the comparative family, chord, the breakpoint overlay and the prerequisite reads |
| latest-wins token rotation, the `isCurrent` guard, the supersede-vs-end status rule (ADR-080), releasing a completed fetch's token at `end()` | `createStopTokenRotation` | all of them, through the skeleton — `FetchMixin` holds one as a member and lends it to the skeleton for the global family, `installFetch` one per installation otherwise, and `withDiagonalizeProgress` one directly |
| the `prepare` / `run` / `commit` contract and its rules | `FetchPhases` (`@jbrowse/core/util/fetchPhases`) | the skeleton, so the global and comparative families with it; per-region is deliberately not this shape, see `RegionFetchContext` |
| the leading-edge scheduler | `leadingEdgeAutorun` | every installer, plus the dotplot view's region autorun |
| the non-abort fetch-error rule: an abort is the ordinary end of a superseded fetch and is swallowed, so is any failure of a fetch that is no longer current, and only a current fetch's real failure is logged and published | `handleFetchError` (`@jbrowse/core/util`) | `runFetchOnce`, so all of them |

`FetchMixin` reimplemented the rotation rather than wrapping it until
2026-08-20, and the two copies had drifted over whether a completed fetch
releases its token. `GlobalFetchPhases` and the comparative installer's inline
`{ prepare, run, commit }` were the same contract declared twice, with the same
three rules explained twice. The error rule was spelled three times and had
drifted on whether the `console.error` was currency-guarded — the comparative
family's pin ("does not let a superseded fetch raise its error") is the
semantic `handleFetchError` now holds for all of them.

Two rules the skeleton owns that a site kept spelling for itself. **Liveness is
checked above the `gate`, not only above `prepare`**: teardown mutates the
observables the body reads before the disposers run, and every gate but the
breakpoint view's reaches the containing view or track through a parent walk —
`host.initialized` on the global family, `isMinimized` on the prerequisite reads
and the lane fetches, `getContainingView` on the sample-list read — which throws
once the node has left the tree. Only the global gate carried its own `isAlive`
before 2026-08-31, and a gateless fetch with a `contract` (chord) classified a
dead-node run as `declined`, spending a reload bump on a corpse. **The rule is
ported, not shared**: the per-region family reaches its gates through
`autorunOnReadyView` rather than through the skeleton, so the check sits there
too — which is also what covers the other three autoruns that family installs.
A rule the skeleton grows next is owed the same two lines, and that is cheaper
than the conversion `REJECTED_IDEAS.md` declines. And **`FetchMixin`'s begin/end/error trio is
`fetchMixinLifecycle`**, one function for the two entries that run a fetch over
that mixin (`runFetch`, and the global family's declaration, which lends its
rotation and so owes the same three writes).

What is left per site is the part that genuinely differs, and it is exactly the
parameter list: the trigger list (which reads wake it, i.e. `prepare` plus
`gate`), the commit shape (one payload versus N streaming regions), where the
loading flag lives (`FetchMixin`'s `activeStopToken` versus the comparative
family's `fetching` — ADR-054 keeps that split), where the status goes
(`report`), and the context a `run` is handed. A family wanting a richer context
than `FetchContext` wraps its own `run` rather than the skeleton growing an
option for it, which is how the comparative family adds `adapterConfig` /
`rename` / `assemblyManager`.

## `untracked` names its ground, and a perf guard is not one

A body may read untracked what its own effect writes (self-write: the
viewport-change clear reads `error` / `fetchCanceled` because it clears them,
and tracking them would re-fire it off `setError` and wipe the flag); a read no
decision branches on and only the launched work consumes (effect input: the axes
behind dotplot's tracked `fetchKey`, which the worker culls with — tracked,
every pan would refetch, because a run of that body *is* a fetch); and a
dev-only check reads untracked so the production dependency set is not a
development one (instrumentation). The test that sorts a read into tracked or
not: **does the decision branch on it?** If so it is tracked, whatever the
idle-run cost. `no-restricted-syntax` fails a bare `untracked(` in source and
each site names its ground on the disable line. Everything else is a guess about
cost, and the two the per-region autorun carried (`isLoading`, `loadedRegions`,
"would re-fire mid-fetch") were measured on 2026-08-23 and deleted: tracked, a
fetch shorter than the 600 ms debounce coalesces the flip into the run
`fetchGeneration` already owes, and a longer one costs one idle run of the pure
plan. Two body runs per fetch cycle either way, three past the debounce, and no
loop, since the re-run lands on the plan's in-flight or covered branch. The
better spelling of the self-write case is structural: read a signal the write
does not move, which is what `fetchGeneration` is and why the body never needed
`isLoading`.

The byte estimate is not dropped here. `RegionTooLargeMixin`'s own
`ClearByteEstimateOnNavOrTierSwap` autorun drops it on the same trigger and on
a tier swap, since both change which fetch the estimate describes — a stale one
would quote the previous chromosome's numbers at the new region until a
re-measure landed. `clearAllRpcData` deliberately leaves it alone, so an
ordinary clear doesn't flicker the banner
(REGION_TOO_LARGE.md § How the verdict is built).

Subclasses override `fetchNeeded` to call one of the fan-out helpers
(`fetchEachRegion`, `fetchAllRegions`, `fetchRegionsBatched`). A gated display
passes `byteLimit: self.resolvedByteLimit()` in its RPC args; the worker
measures the region's index bytes as the feature RPC's first await and answers
a `RegionTooLargeResult` instead of a payload when over, which the helper
commits through `commitFetchBytes` and skips the store for. A blocked display
keeps running that fetch, once per settled viewport, because the measurement is
the only thing that releases the banner and a blocked fetch stops at it.
Oversize regions surface a banner: `DisplayChrome` renders `TooLargeMessage`
from the model's `regionTooLargeReason`.

The `error`/`fetchCanceled` reads in `ClearBlockingStateOnViewportChange` are
`untracked` for correctness — tracking either would let `set…` re-fire the
autorun and wipe the flag before any viewport change.

Variants are the exception to per-region granularity:
`MultiSampleVariantGetCellData` returns one batched payload covering all visible
regions, so variants' `fetchNeeded` ignores `needed` and derives its own region
set (`fetchRegionsForMode`), marking them all loaded together when the work
callback returns. Which set depends on the mode: regular mode takes
`bufferedVisibleRegions` (off-screen variants simply clip), matrix mode takes
`visibleRegions` only — its columns lay out by feature *index* across the visible
width, so a buffered feature would be crammed into the viewport and draw a
connector to an off-screen position.
