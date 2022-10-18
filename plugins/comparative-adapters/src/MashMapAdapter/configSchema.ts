import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const MashMapAdapter = ConfigurationSchema(
  'MashMapAdapter',
  {
    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
    },

    /**
     * !slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    },
    /**
     * !slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    },
    /**
     * !slot
     */
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

export default MashMapAdapter
