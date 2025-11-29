import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config PairwiseIndexedPAFAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const PairwiseIndexedPAFAdapter = ConfigurationSchema(
  'PairwiseIndexedPAFAdapter',
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
      description: 'Alternative to assemblyNames: the target assembly name',
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
    pifGzLocation: {
      type: 'fileLocation',
      description: 'location of pairwise tabix indexed PAF (pif)',
      defaultValue: {
        uri: '/path/to/data/file.pif.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.paf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes file.pif.gz.tbi:
     * ```json
     * {
     *   "type": "PairwiseIndexedPAFAdapter",
     *   "uri": "file.pif.gz",
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
            pifGzLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              location: {
                uri: `${snap.uri}.tbi`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default PairwiseIndexedPAFAdapter
