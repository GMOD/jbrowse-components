import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'
const configSchema = ConfigurationSchema('PluginStoreWidget', {})

export default function PluginStoreWidgetF(pluginManager: PluginManager) {
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
