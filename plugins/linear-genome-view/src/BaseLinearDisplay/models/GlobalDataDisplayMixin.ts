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
 * `shouldFetch` gate + `fetch` action.
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

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves through
// `STNValue<any, …>` to `any`, so extending it silently turns off checking for
// every member below, and a host missing one of them would compile. See the note
// on `FetchSelf` in canvas's fetchMultiRowFeatures.ts.
interface GlobalFetchAutorunHost extends IStateTreeNode {
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
 * Install the fetch-trigger autorun for a `GlobalDataDisplayMixin` display.
 *
 * Unlike `MultiRegionDisplayMixin` (which installs its five fetch autoruns for
 * you), this mixin installs none — each global display owns its trigger. But
 * every global trigger shares the same skeleton: track the viewport,
 * minimize/expand, the `rpcProps()` cache key and `reloadCounter` so any of them
 * refires the fetch, then debounce. This helper owns that skeleton so a display
 * supplies only its own `shouldFetch` gate (reading — and thereby MobX-tracking —
 * its display-specific fetch inputs) and its `fetch` action.
 *
 * Runs through `autorunOnReadyView`, so the body never reads a throwing view
 * getter (`dynamicBlocks`, `width`) before the view is initialized, and
 * re-runs automatically once it is.
 *
 * `rpcProps()` loop hazard: unlike MultiRegion's `SettingsInvalidate` (which
 * clears data in a *separate, undelayed* autorun and so loops synchronously if
 * `rpcProps()` *returns* fetch-derived state — caught by `makeSettingsLoopGuard`),
 * this autorun reads the key and triggers `fetch()` in the *same* debounced body.
 * A fetch-derived value in the payload here loops on the async-fetch cadence
 * (refetch → commit → key changes → reschedule after `delay` → refetch), a slow
 * network thrash rather than a synchronous freeze, so a within-tick counter
 * cannot distinguish it from legitimate rapid interaction. The invariant is the
 * same: `rpcProps()` must return only user-controlled settings, never fetched
 * data (see ARCHITECTURE.md §"rpcProps() loop trap").
 */
export function installGlobalFetchAutorun(
  self: GlobalFetchAutorunHost,
  opts: {
    shouldFetch: () => boolean
    fetch: () => void
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
      // settings, manual reload. Keep them unconditional and above the gate —
      // reading one inside the `if` drops it from the dependency set on every
      // run that decides not to fetch, and then it can never wake the autorun
      // again. That is exactly how `reload()` died on arc, whose `shouldFetch`
      // goes false the moment data loads.
      void view.dynamicBlocks
      void self.isMinimized
      // The getter, not a bare `rpcProps()` in the body: that would track every
      // observable the payload merely READ, refetching where the per-region
      // family wouldn't. `FetchMixin.rpcPropsCacheKey` is the same getter that
      // family's `SettingsInvalidate` watches — one name, one axis.
      void self.rpcPropsCacheKey
      void self.reloadCounter

      // The too-large skip lives here rather than in each composer's
      // `shouldFetch`, because it is not "don't fetch" — it is "don't fetch a
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

      // The only gate here is the display's own. Each `fetch` re-checks
      // isMinimized / view.initialized / an empty viewport for its direct
      // callers, so repeating them would be duplication, not safety.
      const willFetch = opts.shouldFetch()
      noteFetchAutorunRun(willFetch ? 'fetched' : 'declined')
      if (willFetch) {
        opts.fetch()
        debounce.prime()
      }
    },
    {
      scheduler: debounce.scheduler,
      name: opts.name,
    },
  )
}
