import { clamp, getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type { VariantMatrixRenderingBackend } from './components/variantMatrixRenderingBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
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
            rowHeight: self.rowHeight,
            scrollTop: self.scrollTop,
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
