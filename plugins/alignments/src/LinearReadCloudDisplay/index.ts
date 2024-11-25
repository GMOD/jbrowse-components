import { lazy } from 'react'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import configSchemaF from './configSchema'
import stateModelF from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearReadCloudDisplay',
      displayName: 'Read cloud display',
      configSchema,
      stateModel: stateModelF(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      subDisplay: { type: 'LinearAlignmentsDisplay', lowerPanel: true },
      ReactComponent: lazy(() => import('./components/ReactComponent')),
    })
  })
}
