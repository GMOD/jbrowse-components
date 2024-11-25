import { lazy } from 'react'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import configSchemaF from './configSchemaF'
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearSyntenyDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearSyntenyViewHelper',
      ReactComponent: lazy(() => import('./components/Component')),
    })
  })
}
