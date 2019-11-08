import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { configSchema, modelFactory } from './trackhub-registry'
import TrackHubRegistrySelect from './trackhub-registry/TrackHubRegistrySelect'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'UCSCTrackHubRegistryConnection',
          configSchema,
          configEditorComponent: TrackHubRegistrySelect,
          stateModel: modelFactory(pluginManager),
          displayName: 'The Track Hub Registry',
          description: 'A hub from The Track Hub Registry',
          url: '//trackhubregistry.org/',
        }),
    )
  }
}
