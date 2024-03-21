import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import configSchemaF from './configSchemaF'
import stateModelFactory from './model'
import { lazy } from 'react'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      ReactComponent: lazy(() => import('./components/Component')),
      configSchema,
      name: 'LinearSyntenyDisplay',
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearSyntenyView',
    })
  })
}
