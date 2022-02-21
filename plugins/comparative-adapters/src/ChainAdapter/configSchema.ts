import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ChainAdapter',
  {
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    chainLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
