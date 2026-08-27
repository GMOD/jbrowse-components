import {
  assertDisplayContract,
  makeRetryContractCheck,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { isRegionRefused, measuredBytes } from '@jbrowse/core/rpc/byteBudget'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import { autorunOnReadyView } from './displayAutoruns.ts'
import { installClearHoverOnViewportChange } from './installClearHoverOnViewportChange.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { GateFetchState } from './regionTooLargeUtils.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { FetchPhases } from '@jbrowse/core/util/fetchPhases'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * This family's spelling of the shared three-phase contract, over
 * `FetchMixin.runFetch` and its `FetchContext`. The rules live on
 * {@link FetchPhases}; the comparative family names the same type over its own
 * context.
 *
 * `run` may answer the worker's refusal marker in place of a payload, which is
 * how the byte gate reaches this family: the RPC takes `resolvedByteLimit()`,
 * measures before it downloads, and {@link runGlobalFetch} turns the marker
 * into a byte measurement and no commit.
 */
export interface GlobalFetchPhases<TArgs, TResult> extends Omit<
  FetchPhases<TArgs, TResult, FetchContext>,
  'run'
> {
  run: (
    args: TArgs,
    ctx: FetchContext,
  ) => Promise<TResult | RegionTooLargeResult | undefined>
}

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves through
// `STNValue<any, …>` to `any`, so extending it silently turns off checking for
// every member below, and a host missing one of them would compile. See the note
// on `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
export interface GlobalFetchHost extends IStateTreeNode {
  // `FetchMixin`'s: the cancel-safe lifecycle every phase run goes through.
  runFetch: (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
  isMinimized: boolean
  // The freshness trio `GlobalFetchMixin` owns: the resolved signature captured
  // at issue and stamped at commit, and the derived gate that declines a fetch
  // the held data already answers. The gate, not `dataCurrent`: that one also
  // carries `dataSuperseded`, which holds the export and must not refetch.
  fetchSignature: string | undefined
  signatureCurrent: boolean
  commitFetchResult: (commit: () => void, signature: string) => void
  // `RegionTooLargeMixin`'s byte-gate commit pair: the gate as it stood when
  // this fetch was issued, and where the bytes its result reports go. A display
  // that passes no `byteLimit` measures nothing and commits nothing, which is
  // what lets the runner call them unconditionally.
  gateFetchState: () => GateFetchState
  commitFetchBytes: (
    perRegionBytes: (number | undefined)[],
    issued: GateFetchState,
  ) => void
}

export interface GlobalFetchAutorunHost extends GlobalFetchHost {
  reloadCounter: number
  // `FetchMixin`'s durable user-cancel flag and the internal reset that clears
  // it: the gate in the autorun body and the viewport-change clear beside it.
  fetchCanceled: boolean
  cancelFetch: () => void
  // Both `FetchMixin`'s, which `GlobalFetchMixin` composes, and both read only
  // by the dev-only retry check below: the "deliberately not fetching"
  // exemption, and the "a prerequisite fetch has not landed" deferral.
  fetchInert: boolean
  awaitingPrerequisite: boolean
  // `FetchMixin`'s too. `rpcProps` itself is deliberately absent — the getter
  // looks it up dynamically so a subclass keeps its narrow return type.
  rpcPropsCacheKey: string
  // `RegionTooLargeMixin`'s, which `GlobalFetchMixin` composes — so every
  // display reaching this helper has it, and one that opts into no byte gate
  // reads `regionTooLarge` as a literal false, which makes this false too. Its
  // two terms are not listed separately: this helper reads only the combined
  // one, and naming the parts here would invite the expression back.
  gateSkipsMeasuredViewport: boolean
  // The stored-hover clear's inputs — `regionTooLarge` is the fourth axis it
  // watches, `clearHoveredFeature` is `BaseDisplay`'s no-op default a storer
  // overrides. Installed here for the reason the per-region foundation installs
  // it: a display that forgets keeps naming what used to be under the cursor.
  regionTooLarge: boolean
  scrollTop?: number
  clearHoveredFeature: () => void
}

/**
 * One fetch through the phases, with the family's shared gates around them:
 * decline while minimized, while the signature is not yet computable (a
 * prerequisite pending), or while `signatureCurrent` says the held data already
 * answers; then the display's `run` under `FetchMixin.runFetch` (which owns
 * cancellation, the error and the loading flag), the byte measurement its
 * result carried, and a commit that stamps the signature the fetch was *issued*
 * for — captured here, before any await, so a mid-flight view change cannot
 * relabel the data. Each display used to spell some subset of this and each
 * subset was missing a different piece (LD never declined on current data,
 * HiC's signature missed the settings axis, a reload had to remember its own
 * invalidation).
 *
 * **A refused result commits its bytes and nothing else.** `signatureCurrent`
 * therefore stays false, and what stops the autorun spinning on that is
 * `gateSkipsMeasuredViewport` one level up: the commit stamped the viewport the
 * measurement was taken at, so the next run has nothing left to learn until the
 * user moves.
 *
 * Returns the fetch's promise, or `undefined` when the gates or the display's
 * `prepare` declined — so the autorun below can say which happened, and a
 * caller that wants one round trip on demand can await it.
 */
export function runGlobalFetch<TArgs, TResult>(
  self: GlobalFetchHost,
  { prepare, run, commit }: GlobalFetchPhases<TArgs, TResult>,
): Promise<void> | undefined {
  const signature = self.fetchSignature
  if (self.isMinimized || signature === undefined || self.signatureCurrent) {
    return undefined
  }
  const args = prepare()
  if (args === undefined) {
    return undefined
  }
  // Captured before the round trip, so the measurement it comes back with is
  // labelled with the viewport and the tier it was asked for.
  const issued = self.gateFetchState()
  return self.runFetch(async ctx => {
    const result = await run(args, ctx)
    if (result !== undefined && !ctx.isStale()) {
      self.commitFetchBytes([measuredBytes(result)], issued)
      if (!isRegionRefused(result)) {
        self.commitFetchResult(() => {
          commit(result, args)
        }, signature)
      }
    }
  })
}

/**
 * Install the fetch-trigger autorun for a `GlobalFetchMixin` display.
 *
 * Unlike `MultiRegionDisplayMixin` (which installs its five fetch autoruns for
 * you), that mixin installs none — each global display owns its trigger. But
 * every global trigger shares the same skeleton: track the viewport,
 * minimize/expand, the `rpcProps()` cache key and `reloadCounter` so any of them
 * refires the fetch, then debounce. This helper owns that skeleton so a display
 * supplies only its own `prepare` / `run` / `commit`.
 *
 * Runs through `autorunOnReadyView`, so the body never reads a throwing view
 * getter (`dynamicBlocks`, `width`) before the view is initialized, and
 * re-runs automatically once it is. `prepare` inherits that: it is reached only
 * on a ready view, so a composer restating `view.initialized` is restating the
 * skeleton.
 *
 * **What `prepare` adds to the dependency set.** Everything it reads, since it
 * runs synchronously in the autorun body — which for the two displays that used
 * to bail out inside an MST action (MobX runs those untracked) means the
 * viewport pair and the block list join the set. Both were already in it
 * transitively: `dynamicBlocks` above is a computed over `offsetPx`, `bpPerPx`
 * and `width`, so any move that a direct read would catch has already
 * invalidated it. Arc reads `staticBlocks` in its `prepare` on top of that, and
 * static blocks are quantized from the same pair, so it fires on a subset of the
 * runs `dynamicBlocks` already causes. What a `prepare` must NOT do is move a
 * trigger read of its own under a bail-out — that is the failure the trigger
 * list above exists for.
 *
 * `rpcProps()` loop hazard: unlike MultiRegion's `SettingsInvalidate` (which
 * clears data in a *separate, undelayed* autorun and so loops synchronously if
 * `rpcProps()` *returns* fetch-derived state — caught by `makeSettingsLoopGuard`),
 * this autorun reads the key and starts the fetch in the *same* debounced body.
 * A fetch-derived value in the payload here loops on the async-fetch cadence
 * (refetch → commit → key changes → reschedule after `delay` → refetch), a slow
 * network thrash rather than a synchronous freeze, so a within-tick counter
 * cannot distinguish it from legitimate rapid interaction. The invariant is the
 * same: `rpcProps()` must return only user-controlled settings, never fetched
 * data (see ARCHITECTURE.md §"rpcProps() loop trap").
 */
export function installGlobalFetchAutorun<TArgs, TResult>(
  self: GlobalFetchAutorunHost,
  opts: GlobalFetchPhases<TArgs, TResult> & {
    delay: number
    name: string
  },
) {
  // Same dev-only contract check the per-region foundation runs from its
  // `afterAttach`. This is that family's equivalent install point, and the
  // check matters at least as much here: `rpcPropsCacheKey` below is this
  // family's ONLY settings-invalidation path, and there is no
  // `makeSettingsLoopGuard` on this side to notice anything either.
  assertDisplayContract(self, 'installGlobalFetchAutorun')
  // The other half of the same doctrine, and the one this family gets wrong:
  // the trigger reads below guarantee `reload()` re-RUNS the autorun, not that
  // the run reaches a fetch. See makeRetryContractCheck.
  const noteFetchAutorunRun = makeRetryContractCheck(self)

  autorunOnReadyView(
    self,
    view => {
      // These reads are the trigger list: viewport, minimize/expand, user
      // settings, manual reload. Keep them unconditional and above `prepare` —
      // reading one inside a bail-out drops it from the dependency set on every
      // run that decides not to fetch, and then it can never wake the autorun
      // again. That is exactly how `reload()` died on arc, whose gate goes false
      // the moment data loads.
      void view.dynamicBlocks
      void self.isMinimized
      // The getter, not a bare `rpcProps()` in the body: that would track every
      // observable the payload merely READ, refetching where the per-region
      // family wouldn't. `FetchMixin.rpcPropsCacheKey` is the same getter that
      // family's `SettingsInvalidate` watches — one name, one axis.
      void self.rpcPropsCacheKey
      void self.reloadCounter
      // Tracked in the same breath as the counter and for the mirror reason:
      // this one CLOSES the gate. **A cancel is durable — no fetch trigger
      // un-cancels it** — so the only two things that reopen it are Retry
      // (`reload()`, which clears the flag) and the viewport-change clear
      // installed below, and both have to be in the dependency set of the run
      // they were declined by. Until 2026-08 this family read the flag nowhere,
      // so a pan silently un-cancelled through `runFetch`'s own reset and the
      // load the user stopped came straight back.
      if (self.fetchCanceled) {
        // 'gated', not 'declined': the skeleton skipped this run before the
        // display's own `prepare` was consulted, and the overlay standing over
        // it is offering Retry rather than pretending to load.
        noteFetchAutorunRun('gated')
        return false
      }

      // The too-large skip lives here rather than in each composer's
      // `prepare`, because it is not "don't fetch" — it is "don't fetch a
      // viewport you have already measured". A blocked display still runs its
      // fetch once per settled viewport, which costs one index read and no
      // features (the RPC measures and returns the refusal marker — this family
      // has no density axis), and that is the only thing that ever re-measures
      // while the banner holds. Skipping unconditionally, which is what the
      // composers used to do, froze the estimate at the viewport it was
      // captured over.
      // `gateSkipsMeasuredViewport` is the shared spelling — the per-region
      // foundation applies the same one. A display with no byte gate reads
      // `regionTooLarge` as a literal false, so it is never true here.
      if (self.gateSkipsMeasuredViewport) {
        noteFetchAutorunRun('gated')
        return false
      }

      // Below the skeleton's own skip sit only `runGlobalFetch`'s shared gates
      // (minimized, signature pending, data current) and the display's
      // `prepare` — all synchronous in this body, so whatever they read to
      // decline stays tracked and re-wakes the run.
      const started = runGlobalFetch(self, opts) !== undefined
      noteFetchAutorunRun(started ? 'fetched' : 'declined')
      // arms the debounce — the pre-fetch runs (view-init, the resolution list
      // arriving) return false and stay on the leading edge, so track-open
      // never spends a full `delay` with nothing to coalesce. HiC would
      // otherwise stack it on the `CoreGetInfo` round trip.
      return started
    },
    { name: opts.name, delay: opts.delay },
  )

  // The other half of the durability rule, and the per-region family's twin
  // (`ClearBlockingStateOnViewportChange`): a cancel lapses when the user moves
  // the view, because the thing they stopped is no longer the thing they are
  // looking at. Undelayed, and the flag is read `untracked` so setting it
  // cannot fire this autorun and wipe it — only the viewport read may.
  autorunOnReadyView(
    self,
    view => {
      void view.visibleRegions
      // eslint-disable-next-line no-restricted-syntax -- self-write: cancelFetch clears the flag this reads
      if (untracked(() => self.fetchCanceled)) {
        self.cancelFetch()
      }
    },
    { name: 'ClearCancelOnViewportChange' },
  )

  // The per-region foundation's twin, so a global display that stores a hover
  // owes only the `clearHoveredFeature` override. Until 2026-08-27 only that
  // family installed it, and the one global display storing a hover
  // (`MultiWaySyntenyDisplay`) clicked through a zoom onto the gene that used
  // to be under the cursor.
  addDisposer(self, installClearHoverOnViewportChange(self))
}
