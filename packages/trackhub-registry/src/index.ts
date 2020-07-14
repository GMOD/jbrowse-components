import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { configSchema, modelFactory } from './trackhub-registry'
import TrackHubRegistrySelect from './trackhub-registry/TrackHubRegistrySelect'

export default class TrackHubRegistryPlugin extends Plugin {
  name = 'TrackHubRegistryPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'TheTrackHubRegistryConnection',
          configSchema,
          // @ts-ignore
          configEditorComponent: TrackHubRegistrySelect,
          stateModel: modelFactory(pluginManager),
          displayName: 'The Track Hub Registry',
          description: 'A hub from The Track Hub Registry',
          url: '//trackhubregistry.org/',
        }),
    )
  }
}
