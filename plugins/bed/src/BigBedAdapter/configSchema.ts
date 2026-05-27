import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BigBedAdapter
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bigBedLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const BigBedAdapter = ConfigurationSchema(
  'BigBedAdapter',
  {
    /**
     * #slot
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bb',
        locationType: 'UriLocation',
      },
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
    aggregateField: {
      type: 'string',
      description: 'An attribute to aggregate features with',
      defaultValue: 'geneName2',
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
     *   "type": "BigBedAdapter",
     *   "uri": "yourfile.bigBed"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default BigBedAdapter
