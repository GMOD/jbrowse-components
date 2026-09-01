import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'
import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'vcfGzLocation')
}

/**
 * #config VcfTabixAdapter
 * #trackType VariantTrack
 * #fileFormat variants | VCF (tabix)
 * #gotcha TBI cannot index a chromosome longer than 512 Mb, which some plant
 * and animal genomes exceed. Index those with CSI instead: pass `csi: true`
 * alongside the `uri` shorthand, or set both `index.location` and
 * `index.indexType: 'CSI'` explicitly.
 *
 * used to load bgzip-compressed, tabix-indexed VCF files
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index (pass `csi: true` for a
 * `.csi` index):
 * ```js
 * {
 *   type: 'VcfTabixAdapter',
 *   uri: 'https://example.com/variants.vcf.gz',
 * }
 * ```
 */

const VcfTabixAdapter = ConfigurationSchema(
  'VcfTabixAdapter',
  {
    /**
     * #slot
     * location of the bgzip-compressed VCF, sorted by position. Must be bgzip
     * rather than plain gzip, which tabix cannot index.
     */
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.vcf.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
    /**
     * #slot
     * location of a tab-separated table of per-sample metadata. It needs a
     * header row, and its first column must be the sample name exactly as the
     * VCF spells it; every other column (`population`, `superpopulation`, ...)
     * becomes a value the multi-sample variant displays can group, sort and
     * color their sample rows by.
     */
    samplesTsvLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/samples.tsv',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * Matches the feature-track default (5 Mb): the tabix byte estimate is
     * block-granular (a small region still pulls whole BGZF blocks), so a
     * tighter gate trips on routine variant views. VCF text downloads fast; the
     * feature-density gate remains the backstop for genuinely over-dense views.
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
      advanced: true,
    },
    ...densityAdapterConfigSchemaFields,
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.vcf.gz.tbi:
     *
     * ```json
     * {
     *   "type": "VcfTabixAdapter",
     *   "uri": "yourfile.vcf.gz",
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type VcfTabixAdapterConfig = Instance<typeof VcfTabixAdapter>

export default VcfTabixAdapter
