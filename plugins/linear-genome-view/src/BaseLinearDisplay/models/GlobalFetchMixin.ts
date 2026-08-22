import { getContainingView, isDataCurrent } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.ts'
import FetchMixin from './FetchMixin.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'

/**
 * The one spelling of "which block set is this" every global display's
 * `viewSignature` builds on. Block keys encode `assembly:refName:start:end` (and
 * orientation), so the joined string moves exactly when the display would
 * refetch — a block entering, a zoom re-snap — and not on a scroll inside the
 * loaded blocks.
 */
export function blockKeySignature(blocks: { key: string }[]) {
  return blocks.map(b => b.key).join(',')
}

/**
 * Rendering-agnostic foundation for any display holding a single global
 * (non-regional) dataset. Owns the *fetch* concern only — no GPU rendering — so
 * it is shared by GPU global displays (via GlobalDataDisplayMixin) AND
 * main-thread SVG ones (the arc displays), which compose it directly. That's the
 * whole reason it's split out from GlobalDataDisplayMixin: fetch (cancellation,
 * staleness, region-too-large, reload, the svgReady export gate) is orthogonal
 * to how the display paints, so a non-GPU display shouldn't have to drag in
 * RenderLifecycleMixin to get it.
 *
 * Composes:
 *   - RegionTooLargeMixin (regionTooLarge, force-load, …)
 *   - FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
 *                 fetchGeneration)
 *
 * Installs no autoruns — each display owns its fetch trigger, sharing the
 * `installGlobalFetchAutorun` skeleton. `displayPhase` lives in
 * GlobalDataDisplayMixin, not here, because it reads `renderError` from
 * RenderLifecycleMixin — the one genuinely GPU-only piece. A non-GPU composer
 * (arc) defines its own one-line `displayPhase` over the same shared
 * `computeDisplayPhase`, passing `renderError: undefined`.
 *
 * #stateModel GlobalFetchMixin
 * #displayFoundationDef The same single-global fetch foundation without the render lifecycle, so a non-GPU display that paints main-thread SVG does not drag it in.
 * #category display
 */
export default function GlobalFetchMixin() {
  return types
    .compose(
      'GlobalFetchMixin',
      RegionTooLargeMixin(),
      FetchMixin(),
      types.model({}),
    )
    .volatile(() => ({
      /**
       * #volatile
       * `fetchSignature` as it stood when the held data was committed — the
       * loaded half of this family's freshness compare. Written only by
       * `commitFetchResult` and cleared only by `reload`, so a display cannot
       * stamp data it did not fetch or forget to invalidate on retry; the data
       * itself stays display-owned (arc keeps stale arcs on screen under the
       * loading overlay, HiC keeps the stale matrix).
       */
      loadedFetchSignature: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * The containing LinearGenomeView, typed once so no consumer repeats the
       * `getContainingView` cast. Same getter, same name, as
       * `MultiRegionDisplayMixin`'s — declared in both rather than hoisted into
       * the `RegionTooLargeMixin` they share, because that mixin is named for
       * the byte gate and a display composes exactly one of these two families,
       * so the pair can never shadow each other. See the note there for why the
       * name is `lgv` and not `view`.
       */
      get lgv(): LinearGenomeViewModel {
        return getContainingView(self) as LinearGenomeViewModel
      },
      /**
       * #getter
       * Overridable hook, the one freshness input a global display supplies:
       * the signature of what the current *view* calls for — its block set
       * (`blockKeySignature`) plus any view-derived fetch tier, like HiC's
       * binsize. `undefined` means "not computable yet" (view unmeasured, a
       * prerequisite header still in flight) and holds the fetch off.
       *
       * Settings are deliberately not the display's half: `fetchSignature`
       * below appends `rpcPropsCacheKey`, so a field added to `rpcProps()`
       * invalidates held data structurally. HiC hand-folded one settings term
       * in and would have silently missed the second.
       *
       * Default `undefined`, so a display that forgets the override never
       * fetches and never exports — hung is diagnosable, stale ships wrong
       * pixels.
       */
      get viewSignature(): string | undefined {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Signature of the fetch the current view and settings call for — the
       * display's `viewSignature` plus the serialized `rpcProps()` axis. What
       * `runGlobalFetch` gates on, captures at issue, and stamps at commit.
       */
      get fetchSignature(): string | undefined {
        const base = self.viewSignature
        return base === undefined
          ? undefined
          : `${base}|${self.rpcPropsCacheKey}`
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The shared freshness answer, now derived rather than a hook: data has
       * been committed (`loadedFetchSignature` is only ever written beside it)
       * and it was fetched for the current view and settings. A pan inside the
       * loaded blocks stays current; a block entering, a tier step, a settings
       * change or a `reload()` moves one side of the compare and refetches.
       */
      get dataCurrent(): boolean {
        return isDataCurrent(self.loadedFetchSignature, self.fetchSignature)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Policy single-sourced in `computeSvgReady`; this family supplies only
       * its `dataCurrent` predicate. Note it requires the dataset to actually be
       * current, NOT merely "not currently fetching": the fetch trigger is a
       * debounced `afterAttach` autorun, so at export time `isLoading` can still
       * be false with no data yet — a `displayPhase !== 'loading'` test would
       * then capture an empty render. Never gates on `canvasDrawn`, which an
       * off-screen export never sets. Off-screen renderers gate on it via
       * `awaitSvgReady(model)`.
       */
      get svgReady(): boolean {
        return foundationSvgReady(self)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The commit half of `runGlobalFetch`: run the display's own store in the
       * same transaction as the signature stamp, so no observer can see fresh
       * data under a stale signature or the reverse. Being the only writer of
       * `loadedFetchSignature` is what makes `dataCurrent` derivable — a
       * display cannot commit without stamping.
       */
      commitFetchResult(commit: () => void, signature: string) {
        commit()
        self.loadedFetchSignature = signature
      },
      /**
       * #action
       * Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome)
       * require of every display. Clears any error, drops the loaded signature
       * so `dataCurrent` goes false — `runGlobalFetch` gates on it, so a
       * counter bump alone would re-run the autorun into a decline (the dead
       * Retry button arc and HiC each fixed with their own override) — and
       * bumps `reloadCounter` so the fetch autorun re-runs. The data itself
       * survives, staying on screen under the loading overlay. A subclass whose
       * reload needs extra teardown can override and chain.
       */
      reload() {
        self.setError(undefined)
        // clear the durable user-cancel flag synchronously so the overlay flips
        // from "canceled" to "loading" immediately, rather than lingering until
        // the debounced fetch autorun runs runFetch (which also clears it)
        self.fetchCanceled = false
        self.loadedFetchSignature = undefined
        self.reloadCounter += 1
      },
    }))
}

export type GlobalFetchMixinType = ReturnType<typeof GlobalFetchMixin>
