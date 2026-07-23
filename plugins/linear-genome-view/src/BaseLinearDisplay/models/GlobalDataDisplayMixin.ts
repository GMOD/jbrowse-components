import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import GlobalFetchMixin from './GlobalFetchMixin.ts'
import { autorunOnReadyView } from './MultiRegionDisplayMixin.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
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
    .views(() => ({
      /**
       * #getter
       * Whether this display paints a canvas in its current configuration.
       * Default true. Gates the pre-first-paint term of `displayPhase` below
       * (`rendersCanvas && !canvasDrawn`), so a display that can be toggled to
       * show a static non-canvas placeholder instead (LD with `showLDTriangle`
       * off renders an EmptyState, never a canvas) overrides this to false in
       * that state — otherwise the scrim would sit permanently over the
       * placeholder, since `canvasDrawn` never flips without a canvas.
       *
       * Why this is a hook and not inlined away: the pre-paint scrim decision
       * needs TWO facts — "nothing painted yet" (`!canvasDrawn`, on the model)
       * AND "this isn't a deliberate empty placeholder" — and only the display
       * knows the second. The alternative (render the placeholder OUTSIDE
       * `DisplayChrome` so there's no scrim to gate) was considered and rejected:
       * it would dispose/re-init the GPU backend on every toggle and move a
       * render path out of the shared chrome (see ADR-026). So the hook is
       * irreducible given LD's design — a future reader tempted to delete this
       * "single-override" getter must first move LD's EmptyState, or the scrim
       * regresses over the placeholder. Default lives here so the common case
       * (HiC, always a canvas) needs no override.
       */
      get rendersCanvas(): boolean {
        return true
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Same precedence as MultiRegionDisplayMixin (single-sourced in
       * `computeDisplayPhase`). A global display has no per-region staleness
       * axis, but it does have a pre-first-paint window: between component mount
       * and `isLoading` flipping true (on HiC that means the `CoreGetInfo`
       * round-trip its first fetch waits on). Mirror MultiRegion's `!isReady`
       * term with `!canvasDrawn` so the loading scrim shows immediately on open
       * instead of after that gap — gated by `rendersCanvas` so a display
       * showing a static non-canvas placeholder isn't stuck under it. Once
       * painted, `canvasDrawn` stays true through viewport/setting changes
       * (StaleViewportRescaleMixin keeps the last frame up during refetch), so
       * this adds no scrim on pan or zoom — those keep the existing `isLoading`
       * behavior. Reads `renderError` (RenderLifecycleMixin), which is why it
       * lives here, not in GlobalFetchMixin.
       */
      get displayPhase(): DisplayPhase {
        // fetchCanceled keeps the overlay up (showing its retry affordance)
        // even though isLoading has gone false after the user canceled
        return computeDisplayPhase(
          self,
          () =>
            self.isLoading ||
            self.fetchCanceled ||
            (self.rendersCanvas && !self.canvasDrawn),
        )
      },
    }))
}

export type GlobalDataDisplayMixinType = ReturnType<
  typeof GlobalDataDisplayMixin
>

interface GlobalFetchAutorunHost extends IAnyStateTreeNode {
  isMinimized: boolean
  reloadCounter: number
  rpcProps?: () => unknown
}

/**
 * Install the fetch-trigger autorun for a `GlobalDataDisplayMixin` display.
 *
 * Unlike `MultiRegionDisplayMixin` (which installs its five fetch autoruns for
 * you), this mixin installs none — each global display owns its trigger. But
 * every global trigger shares the same skeleton: track the viewport,
 * minimize/expand, `rpcProps()` and `reloadCounter` so any of them refires the
 * fetch, then debounce. This helper owns that skeleton so a display supplies
 * only its own `shouldFetch` gate (reading — and thereby MobX-tracking — its
 * display-specific fetch inputs) and its `fetch` action.
 *
 * Runs through `autorunOnReadyView`, so the body never reads a throwing view
 * getter (`dynamicBlocks`, `width`) before the view is initialized, and
 * re-runs automatically once it is.
 *
 * `rpcProps()` loop hazard: unlike MultiRegion's `SettingsInvalidate` (which
 * clears data in a *separate, undelayed* autorun and so loops synchronously if
 * `rpcProps()` reads fetch-derived state — caught by `makeSettingsLoopGuard`),
 * this autorun reads `rpcProps()` and triggers `fetch()` in the *same* debounced
 * body. A fetch-derived value in `rpcProps()` here loops on the async-fetch
 * cadence (refetch → commit → `rpcProps()` changes → reschedule after `delay` →
 * refetch), a slow network thrash rather than a synchronous freeze, so a
 * within-tick counter cannot distinguish it from legitimate rapid interaction.
 * The invariant is the same: `rpcProps()` must read only user-controlled
 * settings, never fetched data (see ARCHITECTURE.md "rpcProps() loop trap").
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
  // Leading-edge on the *first* fetch, trailing-edge (debounced) after. MobX's
  // built-in `{ delay }` is trailing-only: it schedules even the initial run
  // via setTimeout, so on track-open the first fetch — and thus the loading
  // scrim's `isLoading` and the first data — waits a full `delay` for no
  // interaction to coalesce (HiC additionally can't fetch until `CoreGetInfo`
  // resolves, so this delay stacks on top of that RTT). `primed` flips only
  // once a fetch has actually run, so every run before then fires immediately
  // (a handful: view-init, resolution-list-arrives) while zoom/pan refetches
  // after it debounce exactly as `{ delay }` did. Matters for cold-open latency
  // and render benchmarks.
  let primed = false
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
      void self.rpcProps?.()
      void self.reloadCounter

      // The only gate here is the display's own. Each `fetch` re-checks
      // isMinimized / view.initialized / an empty viewport for its direct
      // callers, so repeating them would be duplication, not safety.
      if (opts.shouldFetch()) {
        opts.fetch()
        primed = true
      }
    },
    {
      scheduler: run => {
        if (primed) {
          setTimeout(run, opts.delay)
        } else {
          run()
        }
      },
      name: opts.name,
    },
  )
}
