import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazy } from 'react'

import { stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('JobsListWidget', {})

export default function JobsListWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      ReactComponent: lazy(() => import('./components/JobsListWidget')),
      configSchema,
      heading: 'Jobs list',
      name: 'JobsListWidget',
      stateModel: stateModelFactory(pluginManager),
    })
  })
}
