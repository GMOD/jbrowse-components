import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config Gff3TabixAdapter
 * #category adapter
 * used to load bgzip-compressed, tabix-indexed GFF3 files
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a
 * `.csi` index instead:
 * ```js
 * {
 *   type: 'Gff3TabixAdapter',
 *   uri: 'https://example.com/genes.gff3.gz',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        gffGzLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
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

const Gff3TabixAdapter = ConfigurationSchema(
  'Gff3TabixAdapter',
  {
    /**
     * #slot
     */
    gffGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gff.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('Gff3TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.indexType
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.gff.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     * the Gff3TabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we requested.
     * you can disable this for certain feature types to avoid fetching e.g. the
     * entire chromosome
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region', 'contig'],
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.gff3.gz.tbi (or .csi if csi:true):
     *
     * ```json
     * {
     *   "type": "Gff3TabixAdapter",
     *   "uri": "yourfile.gff3.gz",
     *   "csi": true
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type Gff3TabixAdapterConfig = Instance<typeof Gff3TabixAdapter>

export default Gff3TabixAdapter
