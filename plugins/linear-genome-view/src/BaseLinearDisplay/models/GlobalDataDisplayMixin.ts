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
       * Whether this display intends to load and paint its one dataset in the
       * current configuration. Default true. Gates the initial-load term of
       * `displayPhase` below, so a display that can be toggled to render nothing
       * (LD with `showLDTriangle` off shows an EmptyState, never a canvas)
       * overrides this to false in that state — otherwise the pre-first-paint
       * scrim would sit permanently over the empty state, since `canvasDrawn`
       * never flips without a canvas.
       */
      get wantsData(): boolean {
        return true
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Same precedence as MultiRegionDisplayMixin (single-sourced in
       * `computeDisplayPhase`). A global display has no per-region staleness
       * axis, but it does have a pre-first-paint window: the fetch trigger is a
       * debounced `afterAttach` autorun (and HiC first round-trips `CoreGetInfo`
       * for its resolutions), so on initial open `isLoading` stays false for up
       * to a second before `runFetch` starts. Mirror MultiRegion's `!isReady`
       * term with `!canvasDrawn` so the loading scrim shows immediately on open
       * instead of after that gap — gated by `wantsData` so a display rendering
       * nothing on purpose isn't stuck under it. Once painted, `canvasDrawn`
       * stays true through viewport/setting changes (StaleViewportRescaleMixin
       * keeps the last frame up during refetch), so this adds no scrim on pan or
       * zoom — those keep the existing `isLoading` behavior. Reads `renderError`
       * (RenderLifecycleMixin), which is why it lives here, not in
       * GlobalFetchMixin.
       */
      get displayPhase(): DisplayPhase {
        // fetchCanceled keeps the overlay up (showing its retry affordance)
        // even though isLoading has gone false after the user canceled
        return computeDisplayPhase(
          self,
          () =>
            self.isLoading ||
            self.fetchCanceled ||
            (self.wantsData && !self.canvasDrawn),
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
 * every global trigger shares the same skeleton: skip while the track is
 * minimized or the viewport has no content blocks; track `rpcProps()` +
 * `reloadCounter` so a settings change or a manual `reload()` refires; and
 * debounce. This helper owns that skeleton so a display supplies only its own
 * `shouldFetch` gate (reading — and thereby MobX-tracking — its display-specific
 * fetch inputs) and its `fetch` action.
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
      if (
        !self.isMinimized &&
        view.dynamicBlocks.contentBlocks.length > 0 &&
        opts.shouldFetch()
      ) {
        // Track user settings + manual reload so either refires the fetch.
        void self.rpcProps?.()
        void self.reloadCounter
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
