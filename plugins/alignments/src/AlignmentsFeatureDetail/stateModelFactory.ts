import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, types } from 'mobx-state-tree'
import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'

export function stateModelFactory(pluginManager: PluginManager) {
  const baseModel = baseModelFactory(pluginManager)
  return types.compose(
    baseModel,
    types.model('AlignmentsFeatureWidget', {
      type: types.literal('AlignmentsFeatureWidget'),
    }),
  )
}

export type AlignmentFeatureWidgetStateModel = ReturnType<
  typeof stateModelFactory
>
export type AlignmentFeatureWidgetModel =
  Instance<AlignmentFeatureWidgetStateModel>
