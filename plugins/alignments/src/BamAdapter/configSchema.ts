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
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bam' },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    fetchSizeLimit: {
      defaultValue: 5_000_000,
      description:
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      type: 'number',
    },

    index: ConfigurationSchema('BamIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        defaultValue: 'BAI',
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
      },
      /**
       * #slot index.location
       */
      location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.bam.bai',
        },
        type: 'fileLocation',
      },
    }),
    /**
     * #slot
     * generally refers to the reference genome assembly's sequence adapter
     * currently needs to be manually added
     */
    sequenceAdapter: {
      defaultValue: null,
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      type: 'frozen',
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
