import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema'
import stateModelFactory from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      ReactComponent: BaseLinearDisplayComponent,
      configSchema,
      displayName: 'Hi-C contact matrix display',
      name: 'LinearHicDisplay',
      stateModel: stateModelFactory(configSchema),
      trackType: 'HicTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
