import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, types } from 'mobx-state-tree'
import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'

/**
 * #stateModel AlignmentsFeatureWidget
 * uses the base feature widget state modelwith some customized UI
 */
export function stateModelFactory(pluginManager: PluginManager) {
  const baseModel = baseModelFactory(pluginManager)
  return types.compose(
    'AlignmentsFeatureWidget',
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
