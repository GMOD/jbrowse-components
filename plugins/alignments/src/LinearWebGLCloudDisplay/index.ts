import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearWebGLCloudDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory
    return new DisplayType({
      name: 'LinearWebGLCloudDisplay',
      displayName: 'WebGL Cloud display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
