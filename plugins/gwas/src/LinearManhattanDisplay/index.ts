import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchemaFactory.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearManhattanDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearManhattanDisplay',
      configSchema,
      stateModel: stateModelFactory(pluginManager, configSchema),
      trackType: 'GWASTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
