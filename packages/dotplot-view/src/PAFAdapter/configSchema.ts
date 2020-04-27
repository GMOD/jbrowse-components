import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'PAFAdapter',
  {
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    pafLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.paf' },
    },
  },
  { explicitlyTyped: true },
)
