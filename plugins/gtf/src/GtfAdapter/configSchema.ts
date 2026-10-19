import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'gtfLocation')
}

/**
 * #config GtfAdapter
 * #category adapter
 * #trackType FeatureTrack
 * #fileFormat feature | GTF (plain) | Loaded entirely into memory; for small files
 * Reads plain-text GTF files, optionally gzipped. The adapter loads the whole
 * file into memory, so use `GtfTabixAdapter` for large files.
 *
 * #example
 * The `uri` shorthand works for plain or gzipped GTF:
 * ```js
 * {
 *   type: 'GtfAdapter',
 *   uri: 'https://example.com/genes.gtf',
 * }
 * ```
 */
const GtfAdapter = ConfigurationSchema(
  'GtfAdapter',
  {
    /**
     * #slot
     */
    gtfLocation: {
      type: 'fileLocation',
      description: 'path to gtf file, also allows for gzipped gtf',
      defaultValue: {
        uri: '/path/to/my.gtf',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    aggregateField: {
      type: 'string',
      description:
        'attribute naming the parent gene that the adapter aggregates transcripts into. The adapter groups transcripts by gene_id where the file has one (gene names are not unique within a reference), so this is the gene label, and the grouping key only for files with no gene_id',
      defaultValue: 'gene_name',
    },
  },
  {
    explicitlyTyped: true,
    closed: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "GtfAdapter",
     *   "uri": "yourfile.gtf"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type GtfAdapterConfig = Instance<typeof GtfAdapter>
export default GtfAdapter
