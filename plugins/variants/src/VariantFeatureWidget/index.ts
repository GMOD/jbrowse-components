import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'

export const configSchema = ConfigurationSchema('VariantFeatureWidget', {})

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

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'VariantFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(() => import('./VariantFeatureWidget')),
      }),
  )
}
