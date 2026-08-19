import {
  assertDisplayContract,
  makeRetryContractCheck,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { leadingEdgeDebounce } from '@jbrowse/core/util/leadingEdgeDebounce'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'

import GlobalFetchMixin from './GlobalFetchMixin.ts'
import { autorunOnReadyView } from './MultiRegionDisplayMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

export type { FetchContext } from './FetchMixin.ts'
export {
  type GlobalFetchMixinType,
  default as GlobalFetchMixin,
} from './GlobalFetchMixin.ts'

/**
 * Mixin for GPU displays that hold a single global (non-regional) dataset —
 * HiC contact matrix, LD triangle, variant matrix, etc.
 *
 * `GlobalFetchMixin` (the rendering-agnostic fetch foundation) + RenderLifecycleMixin
 * (attachRenderingBackend, renderNow, renderError, …) + the GPU `displayPhase`.
 *
 * Unlike MultiRegionDisplayMixin, it owns no per-region state and installs no
 * autoruns. Fetch triggering is left to the display's own afterAttach autorun so
 * each display can express its own trigger conditions (HiC: viewport change; LD:
 * viewport + showLDTriangle + etc). The shared skeleton of that autorun lives in
 * `installGlobalFetchAutorun` (below) — a display supplies only its own
 * `prepare` / `run` / `commit` phases.
 *
 * #stateModel GlobalDataDisplayMixin
 * #displayFoundationDef One non-regional dataset with no per-region partitioning, plus the GPU render lifecycle. Installs no fetch autoruns; the display adds its own via `installGlobalFetchAutorun`.
 * #category display
 */
export default function GlobalDataDisplayMixin() {
  return types
    .compose(
      'GlobalDataDisplayMixin',
      GlobalFetchMixin(),
      RenderLifecycleMixin(),
      types.model({}),
    )
    .views(self => ({
      /**
       * #getter
       * Same render-lifecycle precondition as MultiRegionDisplayMixin (overrides
       * `RenderLifecycleMixin`'s default-true hook): a global display's
       * `renderState` is still sized off view geometry (`totalWidthPx`,
       * `dynamicBlocks`), which throws before the view is measured. Gating the
       * autorun pair here keeps that out of every display's callbacks.
       */
      get canRender() {
        // `self.lgv`, not a second `getContainingView` cast: GlobalFetchMixin
        // already owns that walk for this family, which is the whole point of
        // hoisting it there.
        return self.lgv.initialized
      },

      /**
       * #getter
       * Fills `RenderLifecycleMixin`'s `paintInert` hook — see there for why a
       * failed fetch has to read as finished to the consumers outside the
       * display. The per-region family declares the identical override.
       */
      get paintInert(): boolean {
        return !!self.error
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The display's mutually-exclusive visual state, mapped in
       * `foundationDisplayPhase` — every foundation calls it and supplies only
       * its staleness argument, so a term added to `computeLoadingTerm` reaches
       * all three without being wired three times.
       *
       * This family's argument is the constant `true`, deliberately: a global
       * display keeps the last frame up through a refetch
       * (StaleViewportRescaleMixin rescales it), so a pan or zoom shows no scrim
       * beyond the `isLoading` window. The pre-first-paint scrim it *does* want
       * — the gap between mount and `isLoading` going true, which on HiC is the
       * `CoreGetInfo` round-trip its first fetch waits on — is
       * `computeLoadingTerm`'s shared `rendersCanvas && !canvasDrawn` term, not
       * anything this family spells out.
       *
       * It lives here rather than in `GlobalFetchMixin` because the phase reads
       * `renderError`, which is `RenderLifecycleMixin`'s.
       */
      get displayPhase(): DisplayPhase {
        return foundationDisplayPhase(self, () => true)
      },
    }))
}

export type GlobalDataDisplayMixinType = ReturnType<
  typeof GlobalDataDisplayMixin
>

/**
 * The three phases a global display's fetch is written in, so the two rules
 * that strand a display when either is got wrong are structural rather than
 * remembered. Same contract as the comparative family's
 * `installComparativeFetchAutorun`, over `FetchMixin.runFetch` instead of its
 * own stop-token rotation.
 */
export interface GlobalFetchPhases<TArgs, TResult> {
  /**
   * Runs synchronously inside the autorun, so its reads — on top of the
   * skeleton's own trigger list — are the dependency set. Returning `undefined`
   * skips the run (minimized, an empty viewport, the display's own gate shut);
   * the reads that decided that stay tracked, so the autorun rewakes. Everything
   * the round trip has to be judged against is captured here and travels in
   * `TArgs`: the viewport, the region set, the resolution.
   */
  prepare: () => TArgs | undefined
  /**
   * Owns every await — the RPC, the byte-gate pre-flight, any post-RPC
   * derivation the commit needs — and writes nothing to the model. Returns
   * `undefined` for "nothing to commit", which is what a pre-flight that stopped
   * this fetch says.
   */
  run: (args: TArgs, ctx: FetchContext) => Promise<TResult | undefined>
  /**
   * Synchronous, and reached only while this is still the latest fetch, so a
   * superseded fetch resolving late cannot clobber fresher data. Async work here
   * would reopen exactly that window, which is why it may not await. It takes
   * `args` back, so what it stamps onto the committed data is what the fetch was
   * issued for and not a live re-read.
   */
  commit: (result: TResult, args: TArgs) => void
}

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves through
// `STNValue<any, …>` to `any`, so extending it silently turns off checking for
// every member below, and a host missing one of them would compile. See the note
// on `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
interface GlobalFetchHost extends IStateTreeNode {
  // `FetchMixin`'s: the cancel-safe lifecycle every phase run goes through.
  runFetch: (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
}

interface GlobalFetchAutorunHost extends GlobalFetchHost {
  isMinimized: boolean
  reloadCounter: number
  // Both `FetchMixin`'s, which `GlobalFetchMixin` composes, and both read only
  // by the dev-only retry check below: the "deliberately not fetching"
  // exemption, and the "a prerequisite fetch has not landed" deferral.
  loadingSuppressed: boolean
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
}

/**
 * One fetch through the phases: prepare, then `run` under `FetchMixin.runFetch`
 * (which owns cancellation, the error and the loading flag), then commit while
 * still current. Returns the fetch's promise, or `undefined` when `prepare`
 * declined — so the autorun below can say which happened, and a caller that
 * wants one round trip on demand can await it.
 */
export function runGlobalFetch<TArgs, TResult>(
  self: GlobalFetchHost,
  { prepare, run, commit }: GlobalFetchPhases<TArgs, TResult>,
): Promise<void> | undefined {
  const args = prepare()
  if (args === undefined) {
    return undefined
  }
  return self.runFetch(async ctx => {
    const result = await run(args, ctx)
    if (result !== undefined && !ctx.isStale()) {
      commit(result, args)
    }
  })
}

/**
 * Install the fetch-trigger autorun for a `GlobalDataDisplayMixin` display.
 *
 * Unlike `MultiRegionDisplayMixin` (which installs its five fetch autoruns for
 * you), this mixin installs none — each global display owns its trigger. But
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
  // Leading-edge on the *first* fetch, trailing-edge (debounced) after, so
  // track-open doesn't spend a full `delay` waiting for no interaction to
  // coalesce (HiC additionally can't fetch until `CoreGetInfo` resolves, so the
  // delay would stack on that RTT). Priming only once a fetch has actually run
  // means the handful of pre-fetch runs (view-init, resolution-list-arrives)
  // stay immediate while zoom/pan refetches after it debounce exactly as
  // `{ delay }` did. See leadingEdgeDebounce for why MobX's own `{ delay }`
  // can't do this.
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

  const debounce = leadingEdgeDebounce(opts.delay)
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

      // The too-large skip lives here rather than in each composer's
      // `prepare`, because it is not "don't fetch" — it is "don't fetch a
      // viewport you have already measured". A blocked display still runs its
      // fetch once per settled viewport, which costs one index read and no
      // features (`byteGateBlocksFetch` measures and stops — this family has no
      // density axis), and that is the only thing that ever re-measures while the
      // banner holds. Skipping unconditionally, which is what the composers used
      // to do, froze the estimate at the viewport it was captured over.
      // `gateSkipsMeasuredViewport` is the shared spelling — the per-region
      // foundation applies the same one. A display with no byte gate reads
      // `regionTooLarge` as a literal false, so it is never true here.
      if (self.gateSkipsMeasuredViewport) {
        noteFetchAutorunRun('gated')
        return
      }

      // The only gate below the skeleton's is the display's own `prepare`, and
      // it is one function rather than a gate plus a bail-out prefix: the two
      // used to answer the same question in two places, one tracked and one not.
      const fetching = runGlobalFetch(self, opts)
      const started = fetching !== undefined
      noteFetchAutorunRun(started ? 'fetched' : 'declined')
      if (started) {
        debounce.prime()
      }
    },
    {
      scheduler: debounce.scheduler,
      name: opts.name,
    },
  )
}
