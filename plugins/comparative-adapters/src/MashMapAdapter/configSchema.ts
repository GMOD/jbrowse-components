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
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
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
    outLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mashmap.out',
        locationType: 'UriLocation',
      },
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
     *   "type": "MashMapAdapter",
     *   "uri": "file.out",
     *   "queryAssembly":"hg19",
     *   "targetAssembly":"hg38"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            outLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default MashMapAdapter
