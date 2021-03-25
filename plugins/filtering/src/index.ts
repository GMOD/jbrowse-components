import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchemaFactory as linearFilteringDisplayConfigSchemaFactory,
  modelFactory as linearFilteringDisplayModelFactory,
  ReactComponent as LinearFilteringDisplayReactComponent,
} from './LinearFilteringDisplay'

export default class extends Plugin {
  name = 'FilteringTrackPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addDisplayType(() => {
      const configSchema = linearFilteringDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearFilteringDisplay',
        configSchema,
        stateModel: linearFilteringDisplayModelFactory(configSchema),
        trackType: 'FilteringTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LinearFilteringDisplayReactComponent,
      })
    })
  }
}
