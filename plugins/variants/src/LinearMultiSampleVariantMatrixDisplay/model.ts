import { clamp, getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type { SharedVariantConfigModel } from '../shared/SharedVariantConfigSchema.ts'
import type { VariantMatrixRenderingBackend } from './components/variantMatrixRenderingBackendTypes.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearMultiSampleVariantMatrixDisplay
 * Multi-sample variant display rendering genotypes as a compact sample-by-site
 * matrix, with subpixel column alpha-scaling for anti-aliased parity.
 */
export default function stateModelFactory(
  configSchema: SharedVariantConfigModel,
) {
  return (
    types
      .compose(
        'LinearMultiSampleVariantMatrixDisplay',
        MultiSampleVariantBaseModelF(configSchema, 'matrix'),
        types.model({
          type: types.literal('LinearMultiSampleVariantMatrixDisplay'),
          lineZoneHeight: types.stripDefault(types.number, 20),
        }),
      )
      // Remap the old type literal on active (view-level) display instances. The
      // DisplayType `aliases` only covers the track *config*; the view's display
      // union dispatches on the raw `type`, so it needs this rewrite too.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        snap?.type === 'LinearVariantMatrixDisplay'
          ? { ...snap, type: 'LinearMultiSampleVariantMatrixDisplay' }
          : snap,
      )
      .views(self => ({
        /**
         * #getter
         * True when every visible region is reversed (the view is horizontally
         * flipped). The matrix lays columns out by genomic-ascending feature
         * index, but a flipped view runs the ruler right-to-left, so columns are
         * mirrored to `numFeatures-1-i` to keep them and the genome connector
         * lines from crossing. Mixed forward/reversed regions don't flip.
         */
        get flipped(): boolean {
          const view = getContainingView(self) as LinearGenomeViewModel
          const regions = view.visibleRegions
          return regions.length > 0 && regions.every(r => r.reversed)
        },
      }))
      .views(self => ({
        get blockType() {
          return 'dynamicBlocks'
        },
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * Per-frame render state for the GPU backend — the autorun reads this
         * every time any tracked observable (cellData, scrollTop, rowHeight,
         * canvas width, …) changes.
         */
        get renderState() {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (self.cellData?.mode !== 'matrix') {
            return undefined
          }
          return {
            // Same rounded width the canvas, hit-test, and connector lines use,
            // so cells/lines/clicks stay pixel-aligned.
            canvasWidth: view.totalWidthPxWithoutBorders,
            canvasHeight: self.availableHeight,
            rowHeight: self.effectiveRowHeight,
            scrollTop: self.scrollTop,
            flipped: self.flipped,
          }
        },
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => ({
        setLineZoneHeight(n: number) {
          self.lineZoneHeight = clamp(n, 10, 1000)
          return self.lineZoneHeight
        },
        /**
         * #action
         */
        startRenderingBackend(backend: VariantMatrixRenderingBackend) {
          self.attachRenderingBackend<VariantMatrixRenderingBackend>(backend, {
            upload: b => {
              const { cellData } = self
              if (cellData?.mode === 'matrix') {
                b.uploadData(cellData)
              }
            },
            render: b => {
              const state = self.renderState
              const { cellData } = self
              if (!state) {
                return false
              }
              b.render(cellData?.mode === 'matrix' ? cellData : null, state)
              return true
            },
          })
        },
      }))
  )
}

export type LinearMultiSampleVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiSampleVariantMatrixDisplayModel =
  Instance<LinearMultiSampleVariantMatrixDisplayStateModel>
