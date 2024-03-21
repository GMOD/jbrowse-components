import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ChainAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const ChainAdapter = ConfigurationSchema(
  'ChainAdapter',
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
    chainLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/file.chain' },
      type: 'fileLocation',
    },

    /**
     * #slot
     * can be specified as alternative to assemblyNames
     */
    queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
      type: 'string',
    },

    /**
     * #slot
     * can be specified as alternative to assemblyNames
     */
    targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default ChainAdapter
