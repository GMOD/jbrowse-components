import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'MashMapAdapter',
  {
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
    },
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    },
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    },
    outLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mashmap.out',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)
