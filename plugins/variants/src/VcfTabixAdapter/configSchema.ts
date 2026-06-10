import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        vcfGzLocation: { uri: snap.uri, baseUri: snap.baseUri },
        index: {
          indexType: snap.csi ? 'CSI' : 'TBI',
          location: {
            uri: `${snap.uri}.${snap.csi ? 'csi' : 'tbi'}`,
            baseUri: snap.baseUri,
          },
        },
      }
    : snap
}

/**
 * #config VcfTabixAdapter
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
     */
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.vcf.gz',
        locationType: 'UriLocation',
      },
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
