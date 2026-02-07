import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearWebGLPileupDisplay',
      displayName: 'WebGL Pileup display',
      helpText:
        'GPU-accelerated pileup display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      stateModel: modelFactory(configSchema),
      subDisplay: { type: 'LinearAlignmentsDisplay', lowerPanel: true },
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { default as linearWebGLPileupDisplayStateModelFactory } from './model.ts'
export { default as linearWebGLPileupDisplayConfigSchemaFactory } from './configSchema.ts'
export type { LinearWebGLPileupDisplayModel } from './model.ts'
