import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { samplesTsvAdapterConfigSchemaFields } from '@jbrowse/core/util/samplesTsv'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SplitVcfTabixAdapter
 * #trackType VariantTrack
 * #fileFormat variants | Split VCF (one file per refName)
 * Reads a set of tabix-indexed VCF files, one per chromosome and keyed by
 * refName, for a large call set split by chromosome.
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
     * index flavor for the entries this adapter derives, i.e. the ones
     * `indexLocationMap` does not name. The adapter reads the kind of an index
     * in the map from its `.csi`/`.tbi` extension, so one map can mix the two. `CSI` is
     * required for a reference longer than 512 Mb, which TBI cannot address.
     */
    indexType: {
      model: types.enumeration('IndexType', ['TBI', 'CSI']),
      type: 'stringEnum',
      defaultValue: 'TBI',
    },

    ...samplesTsvAdapterConfigSchemaFields,

    /**
     * #slot
     * The same 5 Mb `VcfTabixAdapter` declares, for the same reason: this
     * adapter implements `getRegionByteSize`, so its reads are byte-gated, and
     * without a limit on the adapter the gate falls back to the display config's
     * conservative 1 Mb (`resolveByteLimit` prefers the adapter's). That gated
     * a split VCF five times tighter than the single-file VCF beside it, on a
     * block-granular tabix estimate that already over-quotes small regions.
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
      advanced: true,
    },
  },
  {
    explicitlyTyped: true,
    closed: true,
  },
)

export type SplitVcfTabixAdapterConfig = Instance<typeof SplitVcfTabixAdapter>

export default SplitVcfTabixAdapter
