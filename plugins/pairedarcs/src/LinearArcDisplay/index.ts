import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'
import { lazy } from 'react'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const name = 'LinearArcDisplay'
    const configSchema = configSchemaFactory(pluginManager, name)
    return new DisplayType({
      name,
      displayName: 'Arc display',
      configSchema,
      stateModel: stateModelFactory(configSchema, name),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/ReactComponent')),
    })
  })
  pluginManager.addDisplayType(() => {
    const name = 'LinearVariantArcDisplay'
    const configSchema = configSchemaFactory(pluginManager, name)
    return new DisplayType({
      name,
      displayName: 'Arc display (variants)',
      configSchema,
      stateModel: stateModelFactory(configSchema, name),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/ReactComponent')),
    })
  })
}
