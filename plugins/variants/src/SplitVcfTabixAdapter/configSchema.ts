import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SplitVcfTabixAdapter
 * #trackType VariantTrack
 * #fileFormat variants | Split VCF (one file per refName)
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
     * index flavor for every entry of `indexLocationMap` — one setting covers
     * them all, so the per-chromosome files have to be indexed the same way.
     * `CSI` is required for a reference longer than 512 Mb, which TBI cannot
     * address.
     */
    indexType: {
      model: types.enumeration('IndexType', ['TBI', 'CSI']),
      type: 'stringEnum',
      defaultValue: 'TBI',
    },

    /**
     * #slot
     * location of a tab-separated table of per-sample metadata, shared by every
     * file in `vcfGzLocationMap`. It needs a header row, and its first column
     * must be the sample name exactly as the VCFs spell it; every other column
     * (`population`, `superpopulation`, ...) becomes a value the multi-sample
     * variant displays can group, sort and color their sample rows by.
     */
    samplesTsvLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/samples.tsv',
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
