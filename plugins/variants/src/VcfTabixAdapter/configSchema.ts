import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config VcfTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const VcfTabixAdapter = ConfigurationSchema(
  'VcfTabixAdapter',
  {
    /**
     * #slot
     */
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' },
    },
    index: ConfigurationSchema('VcfIndex', {
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
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     */
    samplesTsvLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/samples.tsv',
        description:
          'tsv with header like name\tpopulation\tetc. where the first column is required, and is the sample names',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default VcfTabixAdapter
