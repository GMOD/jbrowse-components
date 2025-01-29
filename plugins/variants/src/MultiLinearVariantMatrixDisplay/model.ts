import { getSession } from '@jbrowse/core/util'
import { isAlive, types } from 'mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'

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
      }),
    )

    .volatile(() => ({
      /**
       * #volatile
       */
      lineZoneHeight: 20,
    }))
    .views(self => ({
      get nrow() {
        return self.sources?.length || 1
      },
      /**
       * #getter
       */
      get blockType() {
        return 'dynamicBlocks'
      },
      /**
       * #getter
       */
      get totalHeight() {
        return self.autoHeight
          ? self.height - self.lineZoneHeight
          : this.nrow * self.rowHeightSetting
      },

      /**
       * #getter
       */
      get rowHeight() {
        return self.autoHeight
          ? self.totalHeight / this.nrow
          : self.rowHeightSetting
      },
    }))

    .views(self => ({
      /**
       * #method
       */
      renderProps() {
        const superProps = self.adapterProps()
        return {
          ...superProps,
          notReady:
            superProps.notReady || !self.sources || !self.featuresVolatile,
          renderingMode: self.renderingMode,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          height: self.totalHeight,
          sources: self.sources,
        }
      },
      /**
       * #getter
       */
      get canDisplayLabels() {
        return self.rowHeight > 8 && self.showSidebarLabelsSetting
      },
    }))
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
        afterAttach() {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const { getMultiVariantSourcesAutorun } = await import(
                '../getMultiVariantSourcesAutorun'
              )
              const { getMultiVariantFeaturesAutorun } = await import(
                '../getMultiVariantFeaturesAutorun'
              )

              getMultiVariantSourcesAutorun(self)
              getMultiVariantFeaturesAutorun(self)
            } catch (e) {
              if (isAlive(self)) {
                console.error(e)
                getSession(self).notifyError(`${e}`, e)
              }
            }
          })()
        },

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
