import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? { ...snap, bedLocation: { uri: snap.uri, baseUri: snap.baseUri } }
    : snap
}

/**
 * #config BedAdapter
 * #trackType FeatureTrack
 * #fileFormat feature | BED (plain) | Loaded entirely into memory; for small files
 * #gotcha Named BED columns past `name`/`score`/`strand` (`itemRgb`,
 * `thickStart`, ...) are only guaranteed for BED12 or a track with an
 * `autoSql`/`columnNames`. For a BED7-BED11 file JBrowse cannot know what the
 * extra columns mean, so it exposes them generically as `field6`, `field7`,
 * ... and a jexl callback reading `feature.itemRgb` gets `undefined`. Set
 * `columnNames` to refer to them by name.
 *
 * used to load plain-text BED files. Loads the whole file into memory, so
 * prefer the BedTabixAdapter for large files.
 *
 * #example
 * ```js
 * {
 *   type: 'BedAdapter',
 *   uri: 'https://example.com/features.bed',
 * }
 * ```
 */

const BedAdapter = ConfigurationSchema(
  'BedAdapter',
  {
    /**
     * #slot
     */
    bedLocation: {
      type: 'fileLocation',
      description: 'path to bed file, also allows gzipped bed',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    },
    /**
     * #slot
     */
    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    },
    /**
     * #slot
     */
    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    },
    /**
     * #slot
     */
    colRef: {
      type: 'number',
      description: 'The column to use as a "refName" attribute',
      defaultValue: 0,
    },
    /**
     * #slot
     */
    colStart: {
      type: 'number',
      description: 'The column to use as a "start" attribute',
      defaultValue: 1,
    },
    /**
     * #slot
     */
    colEnd: {
      type: 'number',
      description: 'The column to use as a "end" attribute',
      defaultValue: 2,
    },

    /**
     * #slot
     */
    disableGeneHeuristic: {
      type: 'boolean',
      description:
        'Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications)',
      defaultValue: false,
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
     *   "type": "BedAdapter",
     *   "uri": "yourfile.bed"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type BedAdapterConfig = Instance<typeof BedAdapter>

export default BedAdapter
