import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  configSchema as ucscConfigSchema,
  modelFactory as ucscModelFactory,
} from './ucsc-trackhub'
import {
  configSchema as jbrowse1ConfigSchema,
  modelFactory as jbrowse1ModelFactory,
} from './jbrowse1'

export default class UCSCTrackHubConnection extends Plugin {
  install(pluginManager) {
    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'UCSCTrackHubConnection',
          configSchema: ucscConfigSchema,
          stateModel: ucscModelFactory(pluginManager),
        }),
    )

    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'JBrowse1Connection',
          configSchema: jbrowse1ConfigSchema,
          stateModel: jbrowse1ModelFactory(pluginManager),
        }),
    )
  }
}
