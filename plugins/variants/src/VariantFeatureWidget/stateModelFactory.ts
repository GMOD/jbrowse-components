import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

export function stateModelFactory(pluginManager: PluginManager) {
  const baseModel = baseModelFactory(pluginManager)
  return types.compose(
    baseModel,
    types.model('VariantFeatureWidget', {
      type: types.literal('VariantFeatureWidget'),
      descriptions: types.frozen(),
    }),
  )
}

export type VariantFeatureWidgetStateModel = ReturnType<
  typeof stateModelFactory
>
export type VariantFeatureWidgetModel = Instance<VariantFeatureWidgetStateModel>
