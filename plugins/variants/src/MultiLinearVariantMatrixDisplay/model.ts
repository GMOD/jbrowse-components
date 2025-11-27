import { clamp, getSession } from '@jbrowse/core/util'
import { isAlive, types } from 'mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'
import { setupMultiVariantAutoruns } from '../shared/setupMultiVariantAutoruns'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

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
        rowHeightSetting: types.optional(types.number, 1),
        /**
         * #property
         */
        lineZoneHeight: types.optional(types.number, 20),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get blockType() {
        return 'dynamicBlocks'
      },

      /**
       * #getter
       */
      get featuresReady() {
        return !!self.featuresVolatile
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
          rowHeight: self.rowHeight,
          scrollTop: self.scrollTop,
          sources: self.sources,
        }
      },
      /**
       * #getter
       */
      get canDisplayLabels() {
        return self.rowHeight >= 6 && self.showSidebarLabelsSetting
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

      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          setupMultiVariantAutoruns(self)
          try {
            const { setupMultiVariantAutoruns } = await import(
              '../shared/setupMultiVariantAutoruns'
            )
            setupMultiVariantAutoruns(self)
          } catch (e) {
            if (isAlive(self)) {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            }
          }
        })()
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
