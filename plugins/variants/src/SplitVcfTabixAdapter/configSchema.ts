import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SplitVcfTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const SplitVcfTabixAdapter = ConfigurationSchema(
  'SplitVcfTabixAdapter',
  {
    /**
     * #slot
     * object like `{chr1:{uri:'url to file'}}`
     */
    vcfGzLocationMap: {
      type: 'frozen',
      defaultValue: {},
    },
    /**
     * #slot
     * object like `{chr1:{uri:'url to index'}}`
     */
    indexLocationMap: {
      type: 'frozen',
      defaultValue: {},
    },

    /**
     * #slot
     */
    indexType: {
      type: 'string',
      defaultValue: 'TBI',
    },

    /**
     * #slot
     */
    samplesTsvLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/samples.tsv',
        description:
          'tsv with header like "name\tpopulation\tetc" where the first column is required, and corresponds to the sample names in the VCF files',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,
  },
)

export default SplitVcfTabixAdapter
