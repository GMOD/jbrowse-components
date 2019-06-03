import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as modelFactory } from './model'

export const configSchema = ConfigurationSchema(
  'JBrowse1Connection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfJBrowse1Connection',
    },
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/data/dir/' },
    },
    assemblyName: {
      type: 'string',
      defaultValue: '',
    },
    useAssemblySequences: {
      type: 'boolean',
      defaultValue: false,
    },
  },
  { explicitlyTyped: true },
)
