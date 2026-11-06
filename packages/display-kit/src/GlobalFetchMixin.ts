import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'

import KeyedFetchMixin from './KeyedFetchMixin.ts'
import RegionTooLargeMixin from './RegionTooLargeMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationPaintInert } from './foundationPaintInert.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import {
  containingHost,
  foundationCanRender,
  trackCanvasWidthPx,
} from './foundationView.ts'
import { viewportEmpty } from './viewportEmpty.ts'

import type { RegionHost } from './regionHost.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * A block set as the string every global display's `viewSignature` builds on:
 * it moves when a block enters or the zoom re-snaps, not on a scroll inside
 * the loaded blocks.
 */
export function blockKeySignature(blocks: { key: string }[]) {
  return blocks.map(b => b.key).join(',')
}

/**
 * The foundation for a display holding one non-regional dataset: HiC's contact
 * matrix, the LD triangle, multi-way synteny's lanes. Composes
 * `RegionTooLargeMixin`, `RenderLifecycleMixin` and `KeyedFetchMixin`, and adds
 * the host, the block signatures and the readiness getters that read the view.
 * It installs no autoruns: each display installs its fetch with
 * `installGlobalFetchAutorun`.
 *
 * #stateModel GlobalFetchMixin
 * #displayFoundationDef One non-regional dataset with no per-region partitioning, plus the render lifecycle. Installs no fetch autoruns; the display installs them with `installGlobalFetchAutorun`.
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
       * The view this display reads regions, viewport and scale from; see
       * `containingHost`.
       */
      get host(): RegionHost {
        return containingHost(self)
      },
      /**
       * #getter
       * The CSS width of this display's on-screen canvas, in px; see
       * `trackCanvasWidthPx`. A heatmap laid out over the whole content reads
       * the content width instead (`TriangleMatrixMixin.canvasWidth`).
       */
      get canvasWidthPx(): number {
        return trackCanvasWidthPx(this.host)
      },
      /**
       * #getter
       * The static-block set as a signature, `undefined` before the view is
       * measured: what a `viewSignature` starts from. HiC appends its
       * resolution.
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
       * No content block is on screen, so there is nothing to fetch or paint;
       * see `viewportEmpty.ts`.
       */
      get viewportEmpty(): boolean {
        return viewportEmpty(self.host)
      },
      /**
       * #getter
       * `RenderLifecycleMixin`'s hook: the view has initialized.
       */
      get canRender(): boolean {
        return foundationCanRender(self)
      },
      /**
       * #getter
       * `RenderLifecycleMixin`'s hook: a display that will not fetch shows a
       * placeholder where its canvas would be.
       */
      get rendersCanvas(): boolean {
        return !self.fetchInert
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `RenderLifecycleMixin`'s `paintInert` hook; see
       * `foundationPaintInert`. Overridable for a further inert state.
       */
      get paintInert(): boolean {
        return foundationPaintInert(self)
      },
      /**
       * #getter
       * An SVG export can read this display's data; off-screen renderers wait
       * on it through `awaitSvgReady(model)`. See `foundationSvgReady`.
       */
      get svgReady(): boolean {
        return foundationSvgReady(self)
      },
      /**
       * #getter
       * The display's visual state, mapped by `foundationDisplayPhase`. This
       * family's staleness argument is the constant `true`: the last frame is
       * genomic and draws correctly under the live view, so a pan or zoom shows
       * no scrim beyond the `isLoading` window.
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
