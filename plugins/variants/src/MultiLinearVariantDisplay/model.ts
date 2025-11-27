import { types } from '@jbrowse/mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
