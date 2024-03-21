import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

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
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      },
      /**
       * #slot index.location
       */
      location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.paf.gz.tbi',
        },
        type: 'fileLocation',
      },
    }),

    /**
     * #slot
     */
    pifGzLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/data/file.pif.gz',
      },
      description: 'location of pairwise tabix indexed PAF (pif)',
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
      type: 'string',
    },

    /**
     * #slot
     */
    targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default PairwiseIndexedPAFAdapter
