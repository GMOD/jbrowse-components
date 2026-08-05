import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchemaFactory.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ManhattanReactComponent = lazy(
  () => import('./components/ManhattanReactComponent.tsx'),
)

export default function LinearManhattanDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearManhattanDisplay',
      configSchema,
      stateModel: stateModelFactory(pluginManager, configSchema),
      trackType: 'GWASTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: ManhattanReactComponent,
    })
  })
}
