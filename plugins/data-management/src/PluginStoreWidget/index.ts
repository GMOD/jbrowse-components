import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'

import stateModelFactory from './model'
const configSchema = ConfigurationSchema('PluginStoreWidget', {})

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'PluginStoreWidget',
      heading: 'Plugin store',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/PluginStoreWidget')),
    })
  })
}
