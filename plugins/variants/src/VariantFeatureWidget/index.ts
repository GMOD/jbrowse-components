import { lazy } from 'react'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { stateModelFactory } from './stateModelFactory'
import { configSchema } from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        ReactComponent: lazy(() => import('./VariantFeatureWidget')),
        configSchema: configSchema,
        heading: 'Feature details',
        name: 'VariantFeatureWidget',
        stateModel: stateModelFactory(pluginManager),
      }),
  )
}
