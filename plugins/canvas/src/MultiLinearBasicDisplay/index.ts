import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'MultiLinearBasicDisplay',
      displayName: 'Multi-bed feature display',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'MultiBedTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { default as multiLinearBasicDisplayStateModelFactory } from './model.ts'
export { default as multiLinearBasicDisplayConfigSchemaFactory } from './configSchema.ts'
