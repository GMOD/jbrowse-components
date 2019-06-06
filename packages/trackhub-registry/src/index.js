import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { configSchema, modelFactory } from './trackhub-registry'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'TrackHubRegistryConnection',
          configSchema,
          stateModel: modelFactory(pluginManager),
          displayName: 'The Track Hub Registy',
          description: 'A hub from The Track Hub Registry',
          url: '//trackhubregistry.org/',
        }),
    )
  }
}
