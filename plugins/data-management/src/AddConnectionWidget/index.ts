import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'

import stateModel from './model'
const configSchema = ConfigurationSchema('AddConnectionWidget', {})

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'AddConnectionWidget',
      heading: 'Add a connection',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/AddConnectionWidget')),
    })
  })
}
