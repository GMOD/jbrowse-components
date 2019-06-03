import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as modelFactory } from './model'

export const configSchema = ConfigurationSchema(
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
