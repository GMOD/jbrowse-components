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
