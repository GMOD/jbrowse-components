import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config GtfTabixAdapter
 * #category adapter
 * used to load bgzip-compressed, tabix-indexed GTF files
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index:
 * ```js
 * {
 *   type: 'GtfTabixAdapter',
 *   uri: 'https://example.com/genes.gtf.gz',
 * }
 * ```
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        gtfGzLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        index: {
          location: {
            uri: `${snap.uri}.tbi`,
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
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region', 'contig'],
    },
    /**
     * #slot
     */
    aggregateField: {
      type: 'string',
      description:
        'field used to aggregate multiple transcripts into a single parent gene feature',
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
     * yourfile.gtf.gz.tbi:
     *
     * ```json
     * {
     *   "type": "GtfTabixAdapter",
     *   "uri": "yourfile.gtf.gz"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default GtfTabixAdapter
