import configSchemaFactory from './configSchema'
import modelFactory from './model'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearPileupDisplay',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export {
  modelFactory as linearPileupDisplayStateModelFactory,
  configSchemaFactory as linearPileupDisplayConfigSchemaFactory,
}
