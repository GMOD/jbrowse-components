import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazy } from 'react'

import { stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('JobsListWidget', {})

export default function JobsListWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'JobsListWidget',
      heading: 'Jobs list',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/JobsListWidget')),
    })
  })
}
