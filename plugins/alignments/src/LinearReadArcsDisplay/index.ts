import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'
import stateModelF from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearReadArcsDisplay',
      displayName: 'Read arc display',
      helpText: 'Connect paired end reads and long split reads using arcs',
      configSchema,
      stateModel: stateModelF(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      subDisplay: { type: 'LinearAlignmentsDisplay', lowerPanel: true },
      ReactComponent: lazy(
        () => import('./components/LinearReadArcsReactComponent.tsx'),
      ),
    })
  })
}
