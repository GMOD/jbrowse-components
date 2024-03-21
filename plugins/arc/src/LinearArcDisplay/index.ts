import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      ReactComponent: BaseLinearDisplayComponent,
      configSchema,
      displayName: 'Arc display',
      name: 'LinearArcDisplay',
      stateModel: stateModelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
