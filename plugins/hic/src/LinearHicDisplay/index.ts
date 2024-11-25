import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema'
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearHicDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearHicDisplay',
      displayName: 'Hi-C contact matrix display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'HicTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
