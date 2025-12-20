import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

export function stateModelFactory(pluginManager: PluginManager) {
  const baseModel = baseModelFactory(pluginManager)
  return types.compose(
    baseModel,
    types.model('VariantFeatureWidget', {
      /**
       * #property
       */

      type: types.literal('VariantFeatureWidget'),
      /**
       * #property
       */
      descriptions: types.frozen(),
    }),
  )
}

export type VariantFeatureWidgetStateModel = ReturnType<
  typeof stateModelFactory
>
export type VariantFeatureWidgetModel = Instance<VariantFeatureWidgetStateModel>
