import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import { stateModelFactory } from './model'
import { configSchemaFactory } from './configSchema'

export default function LinearLollipopDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      ReactComponent: BaseLinearDisplayComponent,
      configSchema,
      name: 'LinearLollipopDisplay',
      stateModel: stateModelFactory(configSchema),
      trackType: 'LollipopTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
