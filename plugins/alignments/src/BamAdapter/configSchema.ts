import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config BamAdapter
 * used to configure BAM adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'BamAdapter',
  {
    /**
     * #slot
     */
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam', locationType: 'UriLocation' },
    },

    index: ConfigurationSchema('BamIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
    },
    /**
     * #slot
     * generally refers to the reference genome assembly's sequence adapter
     * currently needs to be manually added
     */
    sequenceAdapter: {
      type: 'frozen',
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      defaultValue: null,
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
