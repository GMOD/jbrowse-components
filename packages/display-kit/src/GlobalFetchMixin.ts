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
       * `currentFetchKey` as it stood when the held data was committed — the
       * loaded half of this family's freshness compare. Written only by
       * `commitFetchResult`, so a display cannot stamp data it did not fetch,
       * and cleared by `reload` for the overlay's sake rather than the
       * refetch's (the skeleton's reload epoch is what overrides its gate). The
       * data itself stays display-owned: arc keeps stale arcs on screen under
       * the loading overlay, HiC keeps the stale matrix.
       */
      loadedFetchKey: undefined as string | undefined,
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
       * The static-block set as a signature, or `undefined` before the view is
       * measured — the building block every `viewSignature` in this family
       * starts from. Arc and multi-way synteny are exactly this; HiC appends
       * its resolution. Declared here so the initialized gate is spelled once.
       */
      get staticBlockSignature(): string | undefined {
        const { host } = this
        return host.initialized
          ? blockKeySignature(host.staticBlocks.contentBlocks)
          : undefined
      },
      /**
       * #getter
       * Overridable hook, the one freshness input a global display supplies:
       * the signature of what the current *view* calls for — its block set
       * (`blockKeySignature`) plus any view-derived fetch tier, like HiC's
       * binsize. `undefined` means "not computable yet" (view unmeasured, a
       * prerequisite header still in flight) and holds the fetch off.
       *
       * Settings and the adapter are deliberately not the display's half:
       * `currentFetchKey` below appends `rpcPropsCacheKey` and
       * `adapterConfigKey`, so a field added to `rpcProps()` or a track
       * re-pointed in the config editor invalidates held data structurally.
       * HiC hand-folded one settings term in and would have silently missed
       * the second.
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
       * Fills `RenderLifecycleMixin`'s hook off `fetchInert`: a display that
       * will never fetch here shows a placeholder where its canvas would be, so
       * `painted` and the pre-first-paint scrim term stop waiting on a paint
       * that cannot come. Sequence and LD each carried this as a second
       * override beside `fetchInert`, always its negation.
       */
      get rendersCanvas(): boolean {
        return !self.fetchInert
      },
      /**
       * #getter
       * Signature of the fetch the current view, settings and adapter call for
       * — the display's `viewSignature` plus the serialized `rpcProps()` axis
       * plus the adapter config. The fetch skeleton's freshness key: captured
       * at issue, compared against the stamp below, and written to it at
       * commit.
       */
      get currentFetchKey(): string | undefined {
        const base = self.viewSignature
        return base === undefined
          ? undefined
          : `${base}|${self.rpcPropsCacheKey}|${self.adapterConfigKey}`
      },
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook (default false): the held data answers the signature,
       * but this display knows it is not what the screen will settle on — a
       * dependent fetch of its own is still out, or a fetch input it writes
       * itself has moved. The same hook `MultiRegionDisplayMixin` declares,
       * for the same reason: the signature compare is structurally blind to
       * anything the display fetches outside its primary fetch, and an export
       * sampling `svgReady` in that window paints the half-filled frame.
       *
       * A term of `dataCurrent` and NOT of the skeleton's freshness gate, so it
       * holds the export and never re-runs the primary fetch. It fails hung, not
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
       * The shared freshness answer every foundation gives: data has been
       * committed (`loadedFetchKey` is only ever written beside it), it
       * was fetched for the current view and settings, and the display is not
       * about to supersede it itself. A pan inside the loaded blocks stays
       * current; a block entering, a tier step, a settings change or a
       * `reload()` moves one side of the compare. **What the fetch autorun
       * gates on is the same compare inside `installFetch`**, not this getter —
       * the skeleton owns it so a reload can override it. This one is for the
       * readers outside the fetch, the export gate above all. The per-region
       * twin is `isCacheValid`: what decides a refetch, and deliberately not
       * the whole freshness answer.
       */
      get dataCurrent(): boolean {
        return (
          isDataCurrent(self.loadedFetchKey, self.currentFetchKey) &&
          !self.dataSuperseded
        )
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
    .actions(self => {
      const superReload = self.reload
      return {
        /**
         * #action
         * The commit half of this family's fetch: run the display's own store in
         * the same transaction as the signature stamp, so no observer can see fresh
         * data under a stale signature or the reverse. Being the only writer of
         * `loadedFetchKey` is what makes `dataCurrent` derivable — a
         * display cannot commit without stamping.
         */
        commitFetchResult(commit: () => void, signature: string) {
          commit()
          self.loadedFetchKey = signature
        },
        /**
         * #action
         * `FetchMixin.reload` (error, cancel, counter — the shared skeleton's
         * reload epoch is what makes that bump override the freshness gate, even
         * against a fetch that commits mid-reload, so nothing here has to
         * remember to invalidate for the retry's sake) plus this family's one
         * addition, for the export gate rather than the refetch: dropping the
         * loaded signature sends `dataCurrent` false, so an export started
         * after the click waits for the refetch instead of capturing what the
         * retry is about to replace. `displayPhase` never reads `dataCurrent`
         * on this family, so nothing changes on screen until the fetch begins;
         * the data itself survives, staying on screen under that overlay. A
         * subclass whose reload needs extra teardown can override and chain.
         */
        reload() {
          superReload()
          self.loadedFetchKey = undefined
        },
      }
    })
}

export type GlobalFetchMixinType = ReturnType<typeof GlobalFetchMixin>
