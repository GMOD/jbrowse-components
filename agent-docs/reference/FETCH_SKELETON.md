---
name: fetch-skeleton
description: The one latest-wins fetch machine every fetch runs on — `installFetch` / `runFetchOnce`, the leading edge, the unconditional trigger reads, the durable cancel, and which of an autorun's reads are tracked. Read before writing a fetch installer or reaching for `untracked`.
audience: internal
kind: spec
---

# The fetch skeleton

## One latest-wins machine, one phase contract

**begin → clear the error → run → commit if still current → `handleFetchError`
→ end.** `runFetchOnce` (`@jbrowse/core/util/installFetch`) is that sequence;
`installFetch` is that plus the autorun over it: the abort rotation, the
leading edge, the unconditional `reloadCounter` read, the durable cancel gate,
and the dev-only contract checks (`assertDisplayContract`,
`makeRetryContractCheck`). Copies of the sequence each missed a different rule,
so a fetch gets it from here rather than spelling it.

| what | where | who runs on it |
| --- | --- | --- |
| the sequence plus the autorun | `installFetch` / `runFetchOnce` | every fetch. `FetchMixin.runFetch` holds `runFetchOnce` for the per-region family (it needs the MST flow); the keyed families lend `FetchMixin`'s rotation through the `rotation` option so `cancelFetch` and the Cancel button reach the fetch; chord, the breakpoint overlay and the prerequisite reads take the installer |
| latest-wins abort rotation, the `isCurrent` guard, the supersede-vs-end status rule (ADR-080) | `createAbortRotation` | all of them, through the skeleton |
| the `prepare` / `run` / `commit` contract | `FetchPhases` (`@jbrowse/core/util/fetchPhases`) | the global and comparative families; per-region is deliberately not this shape (see `RegionFetchContext`) |
| the leading-edge scheduler | `leadingEdgeAutorun` | every installer, plus the dotplot view's region autorun |
| the fetch-error rule: an abort, and any failure of a fetch no longer current, is swallowed; only a current fetch's real failure is logged and published | `handleFetchError` (`@jbrowse/core/util`) | `runFetchOnce`, so all of them |

`fetchMixinLifecycle` holds `FetchMixin`'s begin/end/error writes for the two
entries that run a fetch over it (`runFetch` and the global family's
declaration, which lends its rotation).

**Liveness is checked above the `gate`, not only above `prepare`.** Teardown
mutates the observables the body reads before the disposers run, and nearly
every gate reaches the containing view or track through a parent walk that
throws once the node has left the tree. The rule is ported, not shared: the
per-region family reaches its gates through `autorunOnReadyView`, so the check
sits there, which also covers the other autoruns that family installs. A rule
the skeleton grows next owes the same two lines there. Declaring the per-region
trigger over `installFetch` was declined.

A shared preamble helper (counter read, cancel read, liveness skip) for the two
hand-rolled bodies was declined too. The skeleton stamps the counter as the epoch
and gates on the cancel; the per-region body voids the counter and hands the
cancel to `planRegionFetch`. A preamble would return three values for the second
caller to use one of. Pins keep both honest: `installFetch.test.ts` re-runs a
body that declined, and `installPerRegionFetchAutoruns.test.ts` asserts the whole
dependency set per state.

What differs per site is the parameter list: the trigger list (`prepare` plus
`gate`), the commit shape (one payload vs N streaming regions), where the loading
flag and status live, and the context `run` receives. A family wanting a richer
context wraps its own `run` rather than the skeleton growing an option, as the
comparative family does for `adapterConfig` / `rename` / `assemblyManager`.

## `untracked` names its ground, and a perf guard is not one

A body may read untracked three kinds of thing:

- **Self-write.** What its own effect writes: the viewport-change clear reads
  `error` / `fetchCanceled` because it clears them, and tracking them would
  re-fire it off `setError` and wipe the flag.
- **Effect input.** A read no decision branches on that only the launched work
  consumes: the axes behind dotplot's tracked `fetchKey`, which the worker culls
  with. Tracked, every pan would refetch.
- **Instrumentation.** A dev-only check, so the production dependency set is not
  a development one.

The test that sorts a read: **does the decision branch on it?** If so it is
tracked, whatever the idle-run cost. `no-restricted-syntax` fails a bare
`untracked(` and each site names its ground on the disable line. A perf guess
is not a ground: the per-region autorun's `isLoading` / `loadedRegions` reads
were measured and tracked instead, costing at most one idle run of the pure plan
with no loop. The structural spelling of the self-write case is to read a signal
the write does not move, which is why the body never needed `isLoading`.

`RegionTooLargeMixin`'s `ClearGateMeasurementsOnNavOrTierSwap` autorun drops the
byte estimate on navigation and tier swap, since a stale estimate would quote the
previous chromosome's numbers at the new region. `clearAllRpcData` leaves it
alone so an ordinary clear does not flicker the banner
(REGION_TOO_LARGE.md § How the verdict is built).

Per-region subclasses override `fetchNeeded` to call a fan-out helper
(`fetchEachRegion`, `fetchAllRegions`, `fetchRegionsBatched`). A gated display
passes `byteLimit: self.resolvedByteLimit()`; the worker measures index bytes
first and answers a `RegionTooLargeResult` when over, which the helper commits
through `commitFetchBytes`. A blocked display keeps running that fetch once per
settled viewport, because the measurement is what releases the banner.

Variants are the exception to per-region granularity:
`MultiSampleVariantGetCellData` returns one batched payload, so variants'
`fetchNeeded` ignores `needed` and derives its set (`fetchRegionsForMode`).
Regular mode takes `bufferedVisibleRegions`; matrix mode takes `visibleRegions`
only, because its columns lay out by feature index across the visible width and a
buffered feature would draw a connector to an off-screen position.

## Which reads the per-region autorun tracks

`planRegionFetch` decides as a pure value: fetch this region set, raise this
assembly mismatch, or do nothing for this reason. `installPerRegionFetchAutoruns`
owns what no pure function can state: which reads MobX tracks and which sit
behind a thunk so an early-bailing run does not subscribe to the viewport. Two
test files, one per half, plus `fetchRegions.test.ts` for commit ordering. A test
that transcribes an autorun stays green when the autorun's behavior is deleted;
the split guards against that.

**The dependency set is itself a value.** Every installer builds its reaction
through `namedAutorun` (`@jbrowse/render-core/namedReactions`), which records it
against the node; a bare `autorun` beside an `addDisposer` would opt out of the
tests and nothing would fail. `reactionDependencies(node, name)` returns the
sorted leaf names the reaction subscribed to on its last run. The "dependency set
is the contract" blocks in `installPerRegionFetchAutoruns.test.ts` and
`RenderLifecycleMixin.test.ts` pin the whole list per state, so a trigger dropped
under a gate, a guard that stopped being `untracked`, or a dev check leaking a
read changes the list.

## Every fetch autorun runs on the leading edge

Every installer schedules through `leadingEdgeAutorun`
(`@jbrowse/core/util/leadingEdgeAutorun`). MobX's `autorun(fn, { delay })` is
trailing-edge only, schedules even the first run through `setTimeout`, and put the
whole delay on first paint.

- **The body reports whether it started work, and only that arms the debounce.**
  A run that bails on a guard (view not measured, minimized, gate shut) returns
  nothing and stays on the leading edge. A return value cannot be forgotten the
  way an imperative `prime()` could.
- **The leading edge is one microtask, not the install call.** A model is
  routinely built and configured in the same synchronous block; a fetch issued
  between the two lines is invalidated by the setting that follows and reissued.
  Yielding once collapses the pair. A change after an `await` is a later
  decision and correctly costs a refetch.

**Install order does not matter, because of the microtask.** With the first run
at the install call, autoruns installed before `FetchVisibleRegions` called
`clearAllRpcData`, cancelling a fetch issued first and reissuing it with
identical arguments: a duplicate RPC per track on every open, visible only to a
call count. A new installer owes its first run to a microtask.

**A fast fetch exposes couplings that a slow one hid.** The LGV's coarse blocks
sit on a 500 ms trailing-edge autorun, and wiggle's autoscale domain and the
alignments coverage scale clip to them. Over the empty initial block list both
yield no entries, and no entries means the fallback domain `[0,1]`, not a stale
one: a bigwig line track drew blank. `settledDynamicBlocks` holds the rule:
coarse blocks once the view has settled once, live ones before. Anything
downstream of a fetch that was only correct because the fetch was slow is a
coupling; the empty-versus-stale distinction is where it bites.

## The global-fetch trigger list must be read unconditionally

`installFetch` reads `reloadCounter` and `fetchCanceled` unconditionally at the
top of its body, above every gate, and that ordering is load-bearing. MobX
rebuilds the dependency set on every run, so a read inside the gate drops out on
any run that declines, and can then never wake the autorun again. The deleted arc
display exposed it: its `prepare` declined while `dataCurrent` was true, so with
`reloadCounter` under the gate `reload()` was silently dead.

The viewport and the `rpcProps()` cache key (`FetchMixin.settingsFetchInputs`)
are the global family's other two trigger axes. Both ride `currentFetchKey`,
which `prepare` and the freshness gate read on every run the gates let through.

**`prepare` returning `undefined` is the display's gate**, one function rather
than a predicate plus a bail-out prefix. It runs synchronously in the autorun
body, so whatever it read to decline stays in the dependency set. The skeleton's
`gate` already declines while `view.initialized` is false, so `prepare` need not
restate that. A `prepare` must not move a trigger read of its own under a
bail-out.

The general rule: **a gated trigger read is safe only if the gate is itself an
observable that flips on the transition you want to wake up on.**
`if (self.isMinimized) return` above the tracked deps is fine, since
un-minimizing re-runs the body. A pure signal like `reloadCounter`, which no gate
consults, is the dangerous case. `installGlobalFetchAutorun.test.ts` pins this
for the skeleton and `installPerRegionFetchAutoruns.test.ts` for the hand-rolled
family, asserting `reloadCounter`, `fetchCanceled` and `alive` stay visible in
the declining states (minimized, errored).

**A gate on committed state is `installFetch`'s `fetchKey`, not a compare in
`prepare`.** The skeleton stamps the key at commit and declines on it, and a run
whose `reloadCounter` advanced since the run that last issued a fetch ignores it,
so a reload refetches with nothing to clear. The split matters because only one
decline can strand a display: `prepare` returning `undefined` is "nothing to
fetch", a legitimate decline no retry should change, while the key gate is "I
have exactly this", which a retry must override. The stamp is observable (the
skeleton's own `observable.box`, or the host's `loadedFetchKey`), because a
commit landing after the inputs moved back must wake the declined run; a closure
variable would leave the late commit's data under the earlier viewport. Both
keyed installers gate on `KeyedFetchMixin.currentFetchKey` (the display's
`viewSignature` plus settings and adapter axes, since neither comparative
display's signature carries an adapter term), and `dataCurrent` compares the same
getter against the same stamp, so the gate and the export gate cannot disagree.
A secondary fetch passes no `contract` and installs no `makeRetryContractCheck`
(one ledger per node, one `lastCounter` per check), and the multi-way synteny
display's dependent fetches once shipped a dead Retry from a hand-compared key
in `prepare`. Pinned in `installFetch.test.ts`.

`GlobalFetchMixin.reload()` still drops `loadedFetchKey`, for the overlay:
`dataCurrent` goes false so the refetch shows as loading while the data stays on
screen.

**The per-region twin: a `fetchNeeded` that declines to fetch must be woken by
something `FetchVisibleRegions` already tracks.** That autorun tests
`isBlockCovered(...) && isCacheValid(...)`, and `&&` short-circuits, so an
uncovered block registers no `isCacheValid` dependency. It is safe because an
uncovered block always reaches `fetchNeeded` and a fetch bumps
`fetchGeneration`. An override returning early without fetching breaks the chain
and must supply its own wake path. Both in-tree cases do: sequence's `zoomedOut`
moves with `bpPerPx`; multi-sample variant's `!sourcesBase` refetches through
`SettingsInvalidate` because `rpcProps().sampleFilter` goes from `undefined` to a
list when sources arrive. That is why `sampleFilter` spells the unfiltered case
out in full: reusing `undefined` would leave the key unchanged when sources
landed, and the display would wedge.

**The comparative family reads `reloadCounter` above its `prepare()` bail-outs
for the same reason.** After a failure every fetch input is unchanged, so
clearing the error alone refires nothing. Every fetch carries a pure signal, read
unconditionally, pinned by its installer's test:

| family | installer | the pure signal | a user cancel lapses on | pinned by |
| --- | --- | --- | --- | --- |
| per-region | `installPerRegionFetchAutoruns` | `fetchGeneration` | a viewport change, or Retry | `installPerRegionFetchAutoruns.test.ts` |
| global | `installGlobalFetchAutorun` | `reloadCounter` | a viewport change, or Retry | `installGlobalFetchAutorun.test.ts` |
| comparative | `installComparativeFetchAutorun` | `reloadCounter` | Retry | `installComparativeFetchAutorun.test.ts` |
| everything else | `installFetch` | `reloadCounter` | Retry, where the host has a cancel | `installFetch.test.ts` |

A fifth skeleton with a gate needs a signal the gate never consults, read above
the gate, and a test that fails when the read is deleted.

The prerequisite reads (HiC header, multi-sample sample list, a synteny file's
LOD header via `LodTierInfoMixin`, the mark display's source list) share
`installPrerequisiteFetch` (`@jbrowse/core/util`): one RPC about the adapter
itself, keyed on the adapter config, gated on minimized. It sits in core because
the four are on three different fetch foundations. A display reads the answer
through `readFor`, which compares by value as the key does, since an undo rebuilds
a track's config into an equal but new object.

**A cancel is durable.** No fetch trigger un-cancels it: the skeleton reads
`fetchCanceled` tracked, under the counter and above every gate. Only Retry and,
on the LGV families, the viewport moving reopen it, since the thing the user
stopped is no longer what they are looking at. The comparative family has the
gate but not the lapse, because its viewport is its fetch input, so a viewport
clear there would un-cancel on every trigger.

**`reloadCounter` lives on `FetchMixin`**, which every fetch foundation composes.
Chord and the breakpoint view declare their own because neither composes
`FetchMixin`.
