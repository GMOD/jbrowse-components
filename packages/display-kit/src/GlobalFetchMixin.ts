import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'

import KeyedFetchMixin from './KeyedFetchMixin.ts'
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
 *   - KeyedFetchMixin (FetchMixin's runFetch, cancelFetch, isLoading, error,
 *                      statusMessage, fetchGeneration, plus the
 *                      `currentFetchKey` / `loadedFetchKey` freshness pair
 *                      the comparative family composes too)
 *
 * What is left here is what only an LGV display can say: the hosting
 * `RegionHost`, the static-block signature every `viewSignature` in this family
 * starts from, and the readiness getters that read the view — `viewportEmpty`,
 * `canRender`, `paintInert`, `svgReady`, `displayPhase`.
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
      KeyedFetchMixin(),
      types.model({}),
    )
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
       * The same over `dynamicBlocks`, for a display whose fetch window is the
       * live viewport rather than the snapped block set (LD).
       */
      get dynamicBlockSignature(): string | undefined {
        const { host } = this
        return host.initialized
          ? blockKeySignature(host.dynamicBlocks.contentBlocks)
          : undefined
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
}

export type GlobalFetchMixinType = ReturnType<typeof GlobalFetchMixin>
