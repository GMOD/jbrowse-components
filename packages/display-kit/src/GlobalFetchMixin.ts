import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from './RegionTooLargeMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationPaintInert } from './foundationPaintInert.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import { containingHost, foundationCanRender } from './foundationView.ts'
import { viewportEmpty } from './viewportEmpty.ts'

import type { RegionHost } from './regionHost.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

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
 * **The** foundation for a display holding a single global (non-regional)
 * dataset — HiC's contact matrix, the LD triangle, both arc displays. One
 * foundation rather than the two this family carried until 2026-08-23:
 * `GlobalDataDisplayMixin` existed only to layer `RenderLifecycleMixin` on top
 * for the GPU composers, because arc paints its own main-thread Canvas2D and
 * declined it — so the fetch foundation was split in two, and the three getters
 * on the upper half (`canRender`, `paintInert`, `displayPhase`) were reachable
 * only by whichever displays composed it. A display that composes this now gets
 * the whole answer, and arc pays five unused volatiles and two autoruns it
 * never installs (`attachRenderingBackend` is what installs them, and arc never
 * calls it) for the same table row as everyone else.
 *
 * Composes:
 *   - RegionTooLargeMixin (regionTooLarge, force-load, …)
 *   - RenderLifecycleMixin (attachRenderingBackend, renderNow, renderError, …)
 *   - FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
 *                 fetchGeneration)
 *
 * Installs no autoruns — each display owns its fetch trigger, sharing the
 * `installGlobalFetchAutorun` skeleton, to which it supplies only its own
 * `prepare` / `run` / `commit` phases.
 *
 * #stateModel GlobalFetchMixin
 * #displayFoundationDef One non-regional dataset with no per-region partitioning, plus the render lifecycle. Installs no fetch autoruns; the display adds its own via `installGlobalFetchAutorun`.
 * #category display
 */
export default function GlobalFetchMixin() {
  return types
    .compose(
      'GlobalFetchMixin',
      RegionTooLargeMixin(),
      RenderLifecycleMixin(),
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
       * The hosting view as the `RegionHost` contract — see `containingHost` for the cast it
       * owns, why the name is `host` and not `view`, and why both foundations
       * still declare the name over one body.
       */
      get host(): RegionHost {
        return containingHost(self)
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
       * No content block is on screen, so this display has nothing to fetch and
       * nothing to paint — see `viewportEmpty.ts` for the one viewport that
       * reaches it, how narrow that is, and why the state still has to be
       * terminal rather than a permanent scrim. Both foundations declare it over
       * that one expression, the same way they each declare `host` and
       * `paintInert`.
       */
      get viewportEmpty(): boolean {
        return viewportEmpty(self.host)
      },
      /**
       * #getter
       * Overrides `RenderLifecycleMixin`'s default-true hook with the LGV
       * precondition both foundations share — see `foundationCanRender`.
       */
      get canRender(): boolean {
        return foundationCanRender(self)
      },
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
       * The fetch gate: data has been committed (`loadedFetchSignature` is only
       * ever written beside it) and it was fetched for the current view and
       * settings. A pan inside the loaded blocks stays current; a block
       * entering, a tier step, a settings change or a `reload()` moves one side
       * of the compare and `runGlobalFetch` refetches. The per-region twin is
       * `isCacheValid`: what decides a refetch, and deliberately not the whole
       * freshness answer below.
       */
      get signatureCurrent(): boolean {
        return isDataCurrent(self.loadedFetchSignature, self.fetchSignature)
      },
      /**
       * #getter
       * Overridable hook (default false): the held data answers the signature,
       * but this display knows it is not what the screen will settle on — a
       * dependent fetch of its own is still out, or a fetch input it writes
       * itself has moved. The same hook `MultiRegionDisplayMixin` declares,
       * for the same reason: the signature compare is structurally blind to
       * anything the display fetches outside `runGlobalFetch`, and an export
       * sampling `svgReady` in that window paints the half-filled frame.
       *
       * Folded into `dataCurrent` and NOT into `signatureCurrent`, so it holds
       * the export and never re-runs the primary fetch. It fails hung, not
       * stale: a value that latches true parks `awaitSvgReady` on its backstop,
       * so state only what a later commit is guaranteed to clear.
       */
      get dataSuperseded(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The shared freshness answer every foundation gives (`dataCurrent`):
       * the fetch gate above, minus the display's own supersession. What the
       * export gate reads; never what the fetch gate reads.
       */
      get dataCurrent(): boolean {
        return self.signatureCurrent && !self.dataSuperseded
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Fills `RenderLifecycleMixin`'s `paintInert` hook — see there for why a
       * failed fetch has to read as finished to the consumers outside the
       * display, and `foundationPaintInert` for the second such state and why
       * both fetch families answer it through one function. Overridable, as the
       * hook is: a display with a third inert state of its own says so here.
       */
      get paintInert(): boolean {
        return foundationPaintInert(self)
      },
      /**
       * #getter
       * Policy single-sourced in `computeSvgReady`; this family supplies only
       * the freshness half, which `foundationSvgReady` reads as `dataCurrent`
       * or the vacuous currency of `viewportEmpty`. Note it requires the dataset
       * to actually be current, NOT merely "not currently fetching": the fetch
       * trigger is a debounced `afterAttach` autorun, so at export time
       * `isLoading` can still be false with no data yet — a
       * `displayPhase !== 'loading'` test would then capture an empty render.
       * Never gates on `canvasDrawn`, which an off-screen export never sets.
       * Off-screen renderers gate on it via `awaitSvgReady(model)`.
       */
      get svgReady(): boolean {
        return foundationSvgReady(self)
      },
      /**
       * #getter
       * The display's mutually-exclusive visual state, mapped in
       * `foundationDisplayPhase` — every foundation calls it and supplies only
       * its staleness argument, so a term added to `computeLoadingTerm` reaches
       * all of them without being wired twice.
       *
       * This family's argument is the constant `true`, deliberately: a global
       * display keeps the last frame up through a refetch (worker output is
       * genomic, so the stale frame draws correctly under the live view
       * transform), so a pan or zoom shows no scrim beyond the `isLoading`
       * window. The pre-first-paint scrim it *does* want — the gap between mount
       * and `isLoading` going true, which on HiC is the `CoreGetInfo` round trip
       * its first fetch waits on — is `computeLoadingTerm`'s shared
       * `rendersCanvas && !canvasDrawn` term, not anything this family spells
       * out.
       *
       * A display with no rendering backend narrows this to the backend-free
       * `DisplayStatusPhase` with `foundationDisplayStatusPhase`, which is what
       * arc does: it cannot reach `renderError`, and the narrower type is what
       * lets `DisplayStatusChrome` take it with neither a cast nor a dead
       * branch.
       */
      get displayPhase(): DisplayPhase {
        return foundationDisplayPhase(
          self,
          () => true,
          () => self.host.effectiveBodyMounted,
        )
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
       * require of every display. Clears any error and bumps `reloadCounter` so
       * the fetch autorun re-runs — the shared skeleton's reload epoch is what
       * makes that bump override the freshness gate, even against a fetch that
       * commits mid-reload, so nothing here has to remember to invalidate for
       * the retry's sake. Dropping the loaded signature is for the overlay
       * instead: `dataCurrent` goes false, so the refetch shows as loading
       * rather than as a display claiming fresh data. The data itself survives,
       * staying on screen under that overlay. A subclass whose reload needs
       * extra teardown can override and chain.
       */
      reload() {
        self.setError(undefined)
        // clear the durable user-cancel flag synchronously so the overlay flips
        // from "canceled" to "loading" immediately, rather than lingering until
        // the debounced fetch autorun's next run clears it at begin
        self.fetchCanceled = false
        self.loadedFetchSignature = undefined
        self.reloadCounter += 1
      },
    }))
}

export type GlobalFetchMixinType = ReturnType<typeof GlobalFetchMixin>
