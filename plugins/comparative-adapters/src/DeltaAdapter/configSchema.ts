import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'DeltaAdapter',
  {
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    deltaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.delta', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
