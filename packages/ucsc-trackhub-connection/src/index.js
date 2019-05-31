import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import modelFactory from './model'

const configSchema = ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfUCSCTrackHubConnection',
    },
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/hub.txt' },
    },
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    useAssemblySequences: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export default class UCSCTrackHubConnection extends Plugin {
  install(pluginManager) {
    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'UCSCTrackHubConnection',
          configSchema,
          stateModel: modelFactory(pluginManager),
        }),
    )
  }
}
