import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const AlignmentsDisplayComponent = lazy(
  () => import('./components/AlignmentsDisplayComponent.tsx'),
)

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearAlignmentsDisplay',
      displayName: 'Alignments display',
      helpText:
        'GPU-accelerated alignments display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: AlignmentsDisplayComponent,
    })
  })
}

export { default as linearAlignmentsDisplayStateModelFactory } from './model.ts'
export { default as linearAlignmentsDisplayConfigSchemaFactory } from './configSchema.ts'
export type { LinearAlignmentsDisplayModel } from './model.ts'
