import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? { ...snap, vcfLocation: { uri: snap.uri, baseUri: snap.baseUri } }
    : snap
}

/**
 * #config VcfAdapter
 * #trackType VariantTrack
 * #fileFormat variants | VCF (plain) | Loaded entirely into memory; for small files
 * used to load plain-text (non-bgzipped) VCF files. Loads the whole file into
 * memory, so prefer the VcfTabixAdapter for large files.
 *
 * #example
 * ```js
 * {
 *   type: 'VcfAdapter',
 *   uri: 'https://example.com/variants.vcf',
 * }
 * ```
 */

const VcfAdapter = ConfigurationSchema(
  'VcfAdapter',
  {
    /**
     * #slot
     * location of the VCF file. May be gzipped; it is read and parsed in full
     * on first use, so the whole call set has to fit in memory.
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
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "VcfAdapter",
     *   "uri": "yourfile.vcf"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type VcfAdapterConfig = Instance<typeof VcfAdapter>

export default VcfAdapter
