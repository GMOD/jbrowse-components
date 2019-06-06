import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as modelFactory } from './model'

export const configSchema = ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfUCSCTrackHubConnection',
      description: 'a unique name for this connection',
    },
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/path/to/hub.txt' },
      description: 'location of the hub file (usually called hub.txt)',
    },
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'names of the assemblies (genomes) in this hub to connect. if left empty, all assemblies will be connected',
    },
    useAssemblySequences: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'name of any assemblies to use to override an existing assembly sequence. probably safe to ignore this.',
    },
  },
  { explicitlyTyped: true },
)
