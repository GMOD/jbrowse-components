import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
