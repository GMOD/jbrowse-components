import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BlastTabularAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BlastTabularAdapter = ConfigurationSchema(
  'BlastTabularAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Query assembly is the first value in the array, target assembly is the second',
    },

    /**
     * #slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    },
    /**
     * #slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    },
    /**
     * #slot
     */
    blastTableLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/blastTable.tsv',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default BlastTabularAdapter
