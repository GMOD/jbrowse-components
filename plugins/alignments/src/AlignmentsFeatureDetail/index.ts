import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'

const configSchema = ConfigurationSchema('AlignmentsFeatureWidget', {})

export function stateModelFactory(pluginManager: PluginManager) {
  const baseModel = baseModelFactory(pluginManager)
  return types.compose(
    baseModel,
    types.model('AlignmentsFeatureWidget', {
      type: types.literal('AlignmentsFeatureWidget'),
    }),
  )
}

export default function register(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'AlignmentsFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(() => import('./AlignmentsFeatureDetail')),
      }),
  )
}

export { configSchema }
