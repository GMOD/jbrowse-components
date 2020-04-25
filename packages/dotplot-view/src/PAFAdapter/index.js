import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './PAFAdapter'

export const configSchema = ConfigurationSchema(
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
