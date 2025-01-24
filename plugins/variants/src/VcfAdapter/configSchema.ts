import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config VcfAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const VcfAdapter = ConfigurationSchema(
  'VcfAdapter',
  {
    /**
     * #slot
     */
    vcfLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.vcf',
        locationType: 'UriLocation',
      },
    },
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

export default VcfAdapter
