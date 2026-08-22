import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema.ts'

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
      // lazily loaded: the model subgraph is the largest chunk in the plugin,
      // and it is fetched only when an alignments track is shown or a session
      // names this display. Nothing eager may hold a static edge into
      // './model.ts' — see the subpath export in package.json for the one
      // consumer (LGVSyntenyDisplay) that builds on this factory.
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: AlignmentsDisplayComponent,
      aliases: [
        'LinearPileupDisplay',
        'LinearSNPCoverageDisplay',
        'LinearReadArcsDisplay',
        'LinearReadCloudDisplay',
      ],
    })
  })
}

export { default as linearAlignmentsDisplayConfigSchemaFactory } from './configSchema.ts'
export type { LinearAlignmentsDisplayModel } from './model.ts'
