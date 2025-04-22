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
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
    },
    /**
     * #slot
     * can be specified as alternative to assemblyNames
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    },
    /**
     * #slot
     * can be specified as alternative to assemblyNames
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    },
    /**
     * #slot
     */
    chainLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "ChainAdapter",
     *   "uri": "yourfile.chain.gz",
     *   "queryAssembly": "hg19",
     *   "targetAssembly": "hg38"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            chainLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default ChainAdapter
