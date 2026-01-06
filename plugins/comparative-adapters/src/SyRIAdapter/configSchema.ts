import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SyRIAdapter
 * Adapter for loading SyRI (Synteny and Rearrangement Identifier) output files.
 * SyRI output contains pre-computed structural variant classifications (SYN, INV, TRANS, DUP).
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const SyRIAdapter = ConfigurationSchema(
  'SyRIAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The reference assembly name is the first value in the array, query assembly name is the second',
    },
    /**
     * #slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target/reference assembly name',
    },
    /**
     * #slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    },
    /**
     * #slot
     */
    syriLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/syri.out',
        locationType: 'UriLocation',
      },
      description: 'Location of the SyRI output file (.out or .syri.out)',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "SyRIAdapter",
     *   "uri": "syri.out",
     *   "queryAssembly":"ler",
     *   "targetAssembly":"col"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            syriLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default SyRIAdapter
