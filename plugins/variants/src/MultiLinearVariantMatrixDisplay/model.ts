import { clamp } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearVariantMatrixDisplay
 * extends
 * - [MultiVariantBaseModel](../multivariantbasemodel)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantMatrixDisplay'),
        /**
         * #property
         */
        lineZoneHeight: types.optional(types.number, 20),
      }),
    )
    .views(() => ({
      /**
       * #getter
       */
      get blockType() {
        return 'dynamicBlocks'
      },

      /**
       * #getter
       * positions multi-row below the tracklabel even if using overlap
       * tracklabels
       */
      get prefersOffset() {
        return true
      },
    }))
    .views(self => ({
      /**
       * #method
       * Override renderProps to pass the correct height for the matrix renderer
       */
      renderProps() {
        const superProps = self.adapterProps()
        return {
          ...superProps,
          notReady: superProps.notReady || !self.sources || !self.featuresReady,
          renderingMode: self.renderingMode,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
          height: self.autoHeight ? self.totalHeight : self.availableHeight,
          totalHeight: self.totalHeight,
          rowHeight: self.rowHeight,
          scrollTop: self.scrollTop,
          sources: self.sources,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLineZoneHeight(n: number) {
        self.lineZoneHeight = clamp(n, 10, 1000)
        return self.lineZoneHeight
      },
    }))
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
}

export type MultiLinearVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantMatrixDisplayModel =
  Instance<MultiLinearVariantMatrixDisplayStateModel>
