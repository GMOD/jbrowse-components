import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearWebGLFeatureDisplay',
      displayName: 'WebGL feature display',
      helpText:
        'GPU-accelerated feature display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { default as linearWebGLFeatureDisplayStateModelFactory } from './model.ts'
export { default as linearWebGLFeatureDisplayConfigSchemaFactory } from './configSchema.ts'
export type { LinearWebGLFeatureDisplayModel } from './model.ts'
