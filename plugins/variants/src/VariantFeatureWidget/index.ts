import { lazy } from 'react'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { stateModelFactory } from './stateModelFactory'
import { configSchema } from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'VariantFeatureWidget',
        heading: 'Feature details',
        configSchema: configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(() => import('./VariantFeatureWidget')),
      }),
  )
}
