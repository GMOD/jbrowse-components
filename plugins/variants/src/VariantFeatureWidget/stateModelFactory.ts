import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, types } from 'mobx-state-tree'
import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'

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
