import { getSession } from '@jbrowse/core/util'
import { isAlive, types } from 'mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel MultiLinearVariantDisplay
 * extends
 * - [MultiVariantBaseModel](../linearbaredisplay)
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiLinearVariantDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiLinearVariantDisplay'),
        /**
         * #property
         * used only if autoHeight is false
         */
        rowHeightSetting: types.optional(types.number, 11),
        /**
         * #property
         */
        minorAlleleFrequencyFilter: types.optional(types.number, 0),
      }),
    )
    .views(() => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'MultiVariantRenderer'
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

export type MultiLinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantDisplayModel =
  Instance<MultiLinearVariantDisplayStateModel>

export default stateModelFactory
