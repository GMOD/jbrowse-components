import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SplitVcfTabixAdapter
 * #trackType VariantTrack
 * reads a set of per-chromosome VCF files, keyed by refName, instead of a
 * single combined VCF (useful for large call sets split by chromosome)
 *
 * #example
 * ```js
 * {
 *   type: 'SplitVcfTabixAdapter',
 *   vcfGzLocationMap: {
 *     chr1: { uri: 'chr1.vcf.gz' },
 *     chr2: { uri: 'chr2.vcf.gz' },
 *   },
 *   indexLocationMap: {
 *     chr1: { uri: 'chr1.vcf.gz.tbi' },
 *     chr2: { uri: 'chr2.vcf.gz.tbi' },
 *   },
 * }
 * ```
 */

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
      model: types.enumeration('IndexType', ['TBI', 'CSI']),
      type: 'stringEnum',
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

export type SplitVcfTabixAdapterConfig = Instance<typeof SplitVcfTabixAdapter>

export default SplitVcfTabixAdapter
