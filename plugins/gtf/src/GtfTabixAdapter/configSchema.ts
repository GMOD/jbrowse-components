import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config GtfTabixAdapter
 * #category adapter
 * #trackType FeatureTrack
 * #fileFormat feature | GTF (tabix)
 * used to load bgzip-compressed, tabix-indexed GTF files
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a
 * `.csi` index instead:
 * ```js
 * {
 *   type: 'GtfTabixAdapter',
 *   uri: 'https://example.com/genes.gtf.gz',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        gtfGzLocation: {
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

const GtfTabixAdapter = ConfigurationSchema(
  'GtfTabixAdapter',
  {
    /**
     * #slot
     */
    gtfGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gtf.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('GtfTabixIndex', {
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
          uri: '/path/to/my.gtf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     * the GtfTabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we
     * requested. you can disable this for certain feature types to avoid
     * fetching e.g. the entire chromosome
     *
     * the defaults are the whole-sequence records the common annotation sources
     * emit: `region` (NCBI), `supercontig`/`scaffold` (Ensembl, for
     * non-chromosomal sequences), plus `chromosome` and `contig`. They span an
     * entire reference and have no children, so letting one expand the fetch
     * would pull a whole chromosome to gain nothing
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: [
        'chromosome',
        'region',
        'contig',
        'supercontig',
        'scaffold',
      ],
    },
    /**
     * #slot
     */
    aggregateField: {
      type: 'string',
      description:
        'attribute naming the parent gene that transcripts are aggregated into. transcripts are grouped by gene_id where the file has one (gene names are not unique within a reference), so this is the gene label, and the grouping key only for files with no gene_id',
      defaultValue: 'gene_name',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.gtf.gz.tbi (or .csi if csi:true):
     *
     * ```json
     * {
     *   "type": "GtfTabixAdapter",
     *   "uri": "yourfile.gtf.gz",
     *   "csi": true
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type GtfTabixAdapterConfig = Instance<typeof GtfTabixAdapter>

export default GtfTabixAdapter
