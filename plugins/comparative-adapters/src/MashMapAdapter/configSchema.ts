import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MashMapAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const MashMapAdapter = ConfigurationSchema(
  'MashMapAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    outLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/mashmap.out',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
      type: 'string',
    },

    /**
     * #slot
     */
    targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default MashMapAdapter
