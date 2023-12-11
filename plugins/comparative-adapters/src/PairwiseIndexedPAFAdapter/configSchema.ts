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
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
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
    pafGzLocation: {
      type: 'fileLocation',
      description: 'location of pairwise tabix indexed PAF',
      defaultValue: { uri: '/path/to/data/file.paf.gz' },
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
  { explicitlyTyped: true },
)

export default PairwiseIndexedPAFAdapter
