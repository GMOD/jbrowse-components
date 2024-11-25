import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import { stateModelFactory } from './model'
import type PluginManager from '@jbrowse/core/PluginManager'
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
