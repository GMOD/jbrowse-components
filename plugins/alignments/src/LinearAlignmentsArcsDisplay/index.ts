import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import ReactComponent from './ReactComponent'
import configSchemaFactory from './configSchema'
import modelFactory from './model'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearAlignmentsArcsDisplay',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}

export {
  modelFactory as linearPileupDisplayStateModelFactory,
  configSchemaFactory as linearPileupDisplayConfigSchemaFactory,
}
