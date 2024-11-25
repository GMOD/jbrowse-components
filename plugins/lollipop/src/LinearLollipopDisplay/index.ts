import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearLollipopDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearLollipopDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'LollipopTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
