import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as modelFactory } from './model'

export const configSchema = ConfigurationSchema(
  'JBrowse1Connection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfJBrowse1Connection',
      description: 'a unique name for this connection',
    },
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/jbrowse/data/' },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
    },
    assemblyName: {
      type: 'string',
      defaultValue: '',
      description: 'the name of the assembly to which to add tracks',
    },
    useAssemblySequences: {
      type: 'boolean',
      defaultValue: false,
      description:
        'override an existing assembly sequence with the one from this connection. probably safe to ignore this.',
    },
  },
  { explicitlyTyped: true },
)
