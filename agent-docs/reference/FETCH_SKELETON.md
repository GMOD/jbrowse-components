---
name: fetch-skeleton
description: The one latest-wins fetch machine every fetch runs on — `installFetch` / `runFetchOnce`, the leading edge, the unconditional trigger reads, the durable cancel, and which of an autorun's reads are tracked. Read before writing a fetch installer or reaching for `untracked`.
audience: internal
kind: spec
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
| the whole sequence above, plus the autorun over it | `installFetch` / `runFetchOnce` | every fetch — `FetchMixin.runFetch` holds `runFetchOnce` for the per-region family (it needs the MST flow, since its trigger is `planRegionFetch`'s autorun), and everything else takes the installer: the two keyed families (`installGlobalFetchAutorun` and `installComparativeFetchAutorun` lend `FetchMixin`'s rotation through the `rotation` option, so `cancelFetch` and the Cancel button reach the fetch they install), chord, the breakpoint overlay and the prerequisite reads |
| latest-wins token rotation, the `isCurrent` guard, the supersede-vs-end status rule (ADR-080), releasing a completed fetch's token at `end()` | `createStopTokenRotation` | all of them, through the skeleton — `FetchMixin` holds one as a member and lends it to the skeleton for the global and comparative families, `installFetch` one per installation otherwise, and `withDiagonalizeProgress` one directly |
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
than the conversion `agent-docs/rejected-ideas/` declines.

The narrower move — one preamble helper holding the counter read, the cancel
read and the liveness skip, called by both hand-rolled bodies — declines for its
own reason, and it is not the conversion's. The two bodies read the same two
signals and consume them differently: the skeleton keeps the counter as the
epoch it stamps at issue and gates on the cancel, while the per-region body
voids the counter and hands the cancel to `planRegionFetch` beside `error`. And
liveness is not in that body at all, one altitude up in `autorunOnReadyView`,
where it covers four autoruns rather than one. A preamble would hand back three
values for the second caller to use one of, which is a read order shared, not a
rule. What keeps both honest is a pin: `installFetch.test.ts` re-runs a body
that declined, and `installPerRegionFetchAutoruns.test.ts` asserts the whole
dependency set per state (FETCH_SKELETON.md §"The global-fetch trigger list must
be read unconditionally").

And **`FetchMixin`'s begin/end/error trio is `fetchMixinLifecycle`**, one
function for the two entries that run a fetch over that mixin (`runFetch`, and
the global family's declaration, which lends its rotation and so owes the same
three writes).

What is left per site is the part that genuinely differs, and it is exactly the
parameter list: the trigger list (which reads wake it, i.e. `prepare` plus
`gate`), the commit shape (one payload versus N streaming regions), where the
loading flag and the status live (`FetchMixin`'s, through a lent `rotation`, or
the installer's own `report` for a host with no mixin), and the context a `run`
is handed. A family wanting a richer context than `FetchContext` wraps its own
`run` rather than the skeleton growing an option for it, which is how the
comparative family adds `adapterConfig` / `rename` / `assemblyManager`.

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

## Which reads the per-region autorun tracks

**What the autorun decides and what it merely wires are separate files, and the
split is what either half can be tested against.** `planRegionFetch` answers
"given these inputs, what should happen" as a value — fetch this region set,
raise this assembly mismatch, or do nothing for this reason — and is pure, so
its precedence and its buffered-region substitution need no tree.
`installPerRegionFetchAutoruns` owns what no pure function can state: which
reads MobX tracks and which sit behind a thunk so a run that bails early does
not subscribe to the viewport. The plan's thunk parameters are the only thing it
says about that, the way `computeDisplayPhase` takes its `loading` term as one.
Two test files, one per half; a third (`fetchRegions.test.ts`) covers the commit
ordering — a test that transcribes an autorun stays green when the autorun's
behaviour is deleted, which is what the split guards against.

**The dependency set is itself a value, and the wiring test states it.** Every
installer builds its reaction through `namedAutorun`
(`@jbrowse/render-core/namedReactions`), which records it against the node as
well as disposing it with one — a bare `autorun` beside an `addDisposer` would
opt that reaction's set out of the tests below and nothing would fail, so there
is one spelling and no second half to forget. `reactionDependencies(node, name)`
answers, as sorted leaf names, what that reaction subscribed to on its last run
— MobX rebuilds the set every run, so the answer is per state. The mutate-and-
count tests above pin one observable each, and only the ones someone thought to
write; the "dependency set is the contract" blocks in
`installPerRegionFetchAutoruns.test.ts` and `RenderLifecycleMixin.test.ts` pin
the whole list per state instead: the two pure signals present in every state,
the viewport present only while the display can act on it, the in-flight and
coverage reads tracked rather than guarded. A read that moves in or out of a body
— a trigger dropped under a gate, a guard that stopped being `untracked`, a dev
check leaking a read — changes the list, whichever observable it was.

## Every fetch autorun runs on the leading edge

Every fetch installer schedules through `leadingEdgeAutorun`
(`@jbrowse/core/util/leadingEdgeAutorun`), and so does the dotplot view's region
autorun. MobX's own `autorun(fn, { delay })` is trailing-edge only — it schedules
the *first* run through `setTimeout` too — so a cold open spent the whole delay
waiting for no interaction to coalesce, and that latency landed on first paint.
Display creation to first `fetchNeeded` measures **683 ms** under
`{ delay: 600 }` and **112 ms** on the leading edge.

Two properties make it safe:

- **The body reports whether it started work, and only that arms the debounce.**
  A run that bails on a guard — a view not measured, a minimized track, a gate
  shut — returns nothing and stays on the leading edge. A return value cannot
  be forgotten the way an imperative `prime()` call could.
- **The leading edge is one microtask, not the install call.** A model is
  routinely built and then configured in the same synchronous block, and a fetch
  issued between those two lines is issued against the un-configured state,
  invalidated by the setting that follows, and reissued. Yielding once collapses
  that pair back into one run while still starting three orders of magnitude
  sooner than the timer did. A change arriving after an `await` is a later
  decision and correctly costs a refetch.

**The coupling a slow fetch hides.** A fetch that cannot land inside another
debounce's first window is a coupling nobody had to state. The LGV's coarse blocks are on a 500 ms trailing-edge autorun, and two
displays clip a per-bp scan to them so it does not recompute per animation frame
— wiggle's autoscale domain and the alignments coverage scale. Over the *empty*
initial block list both yield no entries, and no entries is not a stale domain
but the fallback one, `[0,1]`: a bigwig line track drew blank and a density
track solid. `settledDynamicBlocks` is the fix and the rule in one place — the
coarse blocks once the view has settled once, the live ones before that — but
the general lesson is the one to carry: **anything downstream of a fetch that
was only ever correct because the fetch was slower than it is a coupling, and
the empty-versus-stale distinction is where it bites.**

**Install order does not matter, because of the microtask.** With the first
run at the install call, the three autoruns installed before `FetchVisibleRegions`
each fired once and two of them called `clearAllRpcData`, so a fetch issued
first was cancelled by `SettingsInvalidate`'s first pass and reissued with
identical arguments — one duplicate RPC per track on every open, visible only
to a call count. **A fourth installer owes nothing to install order; it owes
its first run to a microtask.**

## The global-fetch trigger list must be read unconditionally

The skeleton (`installFetch`, which `installGlobalFetchAutorun` is a
declaration over) reads `reloadCounter` and `fetchCanceled` unconditionally at
the top of its body, above every gate, and that ordering is load-bearing. MobX
rebuilds the dependency set on every run, so a read placed inside the gate drops
out of it on any run that decides not to fetch — and can then never wake the
autorun again. Arc is the shape that exposed this: its `prepare` declines while
`dataCurrent`, which goes true on every successful fetch, so with
`reloadCounter` read under the gate `reload()` was silently dead. The viewport
and the `rpcProps()` cache key (`FetchMixin.rpcPropsCacheKey`, for the reason
in "the cache key is the return value, not the reads") are the global family's
other two trigger axes, and both ride `currentFetchKey`, which `prepare` and the
freshness gate read on every run the gates let through — so any state that can
decline for a signature-shaped reason keeps a signature read that wakes it.

**`prepare` returning `undefined` is the display's gate**, and it is one
function rather than a predicate plus a bail-out prefix inside the fetch — the
two used to answer the same question in two places, one of them tracked and one
not. It runs synchronously in the autorun body, so whatever it read to decline
stays in the dependency set and the autorun rewakes on it; and the skeleton's
`gate` already declines while `view.initialized` is false, so a `prepare`
restating it is restating the skeleton. What it must not do is move a trigger
read of its own under a bail-out, which is the failure this section exists for.

The general rule, which the other fetch autoruns already satisfy: **a gated
trigger read is safe only if the gate is itself an observable that flips on the
transition you want to wake up on.** `if (self.isMinimized) return` above the
tracked deps (synteny, tree-sidebar, the variant sources autorun) is fine —
un-minimizing re-runs the body and re-reads everything. A pure signal like
`reloadCounter`, whose only job is to say "go again" and which no gate consults,
is the dangerous case: nothing else will ever re-run the body on its behalf.
`installGlobalFetchAutorun.test.ts` pins this for the skeleton, and
`installPerRegionFetchAutoruns.test.ts` for the one family that hand-rolls its
own body — the whole dependency set asserted per state, so `reloadCounter`,
`fetchCanceled` and `alive` are visible in the declining states (minimized,
errored) where a gated read would have dropped out.

A gate on a freshness signal must also be invalidated by `reload()` — bumping
`reloadCounter` alone re-runs the autorun but leaves the gate declining. On the
global family that pairing is the skeleton's now: the freshness gate is
`installFetch`'s `fetchKey` (`currentFetchKey` against the stamped
`loadedFetchKey`), and a run whose `reloadCounter` has advanced since the
run that last issued a fetch ignores it — including against a fetch that
commits mid-reload and re-stamps the very signature the reload dropped, a race
the family's hand-rolled gate lost. `GlobalFetchMixin.reload()` still drops
`loadedFetchKey`, but for the overlay: `dataCurrent` goes false, so the
refetch shows as loading while the display's data stays on screen under it.

**The shared skeleton owns the same pairing, for the fetches no check covers.**
A gate on committed state is `installFetch`'s `fetchKey`, not a compare in
`prepare`: the skeleton stamps the key at commit and declines on it, and a run whose `reloadCounter` has
advanced since the run that last *issued* a fetch ignores it, so a reload
refetches with nothing to clear. The split matters because only one of the two
declines can strand a display — `prepare` returning `undefined` is "nothing to
fetch" (an empty viewport, no annotation track configured), a legitimate decline
forever that no retry should change, while the key gate is "I have exactly
this", which a retry must override. The stamp is observable — the skeleton's
own `observable.box`, or the host's `loadedFetchKey` where a keyed foundation
already keeps one — because a commit landing after the inputs moved back is
what has to wake the declined run; a closure variable leaves the late commit's
data under the earlier viewport. Both keyed installers gate on
`KeyedFetchMixin.currentFetchKey` — the display's `viewSignature` plus the
settings and adapter axes, since neither comparative display's signature
carries an adapter term and an adapter edit would otherwise wake the autorun
into a decline — and `dataCurrent` compares the same getter against the same
stamp, so the gate and the export gate cannot disagree on an axis. This exists
because a **secondary** fetch
passes no `contract` and so installs no `makeRetryContractCheck` (one ledger per
node, one `lastCounter` per check — two would each demand a fetch from one
bump), and the multi-way synteny display's two dependent fetches shipped the
dead Retry in that blind spot: a committed key compared by hand in `prepare`,
with no `reload()` override to match. Pinned in `installFetch.test.ts`, which is
where a rule belongs once the skeleton holds it rather than each display.

**The per-region twin: a `fetchNeeded` that declines to fetch must be woken by
something `FetchVisibleRegions` already tracks.** That autorun tests
`isBlockCovered(...) && isCacheValid(...)`, and `&&` short-circuits, so on a run
where the block is uncovered `isCacheValid`'s observables register no
dependency. It's safe only because an uncovered block always reaches
`fetchNeeded`, and a fetch bumps `fetchGeneration` — which the autorun tracks. An
override returning early **without** fetching breaks that chain and must supply
its own wake path from the existing dependency set. Both in-tree cases do:
sequence's `zoomedOut` moves with `bpPerPx`, so `visibleRegions` re-fires it;
multi-sample variant's `!sourcesBase` refetches through `SettingsInvalidate`,
because `rpcProps().sampleFilter` is derived from `sourcesBase` and goes from
`undefined` to a list the moment it arrives. That is also why `sampleFilter`
spells the unfiltered case out in full rather than reusing `undefined` for it:
collapsing the two would leave the key unchanged when sources landed, and the
display would wedge with nothing drawn. Same failure mode as the global rule
above — the autorun settles into a state nothing will wake it from.

**The comparative twin, and why this is a law rather than one installer's
quirk.** `installComparativeFetchAutorun` reads `reloadCounter` above its
`prepare()` bail-outs for exactly the reason arc does, and it was added the same
way — by finding both non-LGV views unable to recover from a fetch error,
because after a failure every fetch input is unchanged and clearing the error
alone refires nothing. So every fetch in the tree now carries the same pure
signal, read unconditionally, each pinned by its installer's test:

| family | installer | the pure signal | a user cancel lapses on | pinned by |
| --- | --- | --- | --- | --- |
| per-region | `installPerRegionFetchAutoruns` | `fetchGeneration` | a viewport change, or Retry | `installPerRegionFetchAutoruns.test.ts` |
| global | `installGlobalFetchAutorun` | `reloadCounter` | a viewport change, or Retry | `installGlobalFetchAutorun.test.ts` |
| comparative | `installComparativeFetchAutorun` | `reloadCounter` | Retry | `installComparativeFetchAutorun.test.ts` |
| everything else | `installFetch` (`@jbrowse/core/util/installFetch`) | `reloadCounter` | Retry, where the host has a cancel at all | `installFetch.test.ts` |

Read the table as the checklist for a fifth: if you add a fetch skeleton with a
gate, it needs a signal the gate never consults, read above the gate, and a test
that fails when the read is deleted. The fourth row is the general one — the
prerequisite reads (HiC's header, the multi-sample sample list), the circular
view's chord fetch and the breakpoint split view's overlay fetch all run on it,
and it reads the signal for them. The three prerequisite reads (HiC's header,
the sample list, the tiered alignment file's LOD header) share one declaration
over it, `installPrerequisiteFetch` (`@jbrowse/core/util`): one RPC about the
adapter itself, tracked on the adapter config and keyed on it, gated on
minimized, reporting where the caller says. They are on three different fetch
foundations, which is why that declaration sits in core beside none of them.

**A cancel is durable, and one rule now says how durable.** No fetch trigger
un-cancels it — the skeleton reads `fetchCanceled` tracked, under the counter
and above every gate, so the two gestures that reopen it are in the dependency
set of the run they closed. Those two are Retry and, on the LGV families, the
viewport moving: the thing the user stopped is no longer the thing they are
looking at. The comparative family has the gate and not the lapse, because its
viewport **is** its fetch input: the same clear there would un-cancel on every
trigger, which is exactly the durability this rule rejects.

**`reloadCounter` is one declaration for all three families.** It lives on
`FetchMixin`, the one mixin every fetch foundation composes — the argument that
already put `fetchInert` there. Chord
and the breakpoint view declare their own, because neither composes
`FetchMixin`.
