import {
  ConfigurationSchema,
  expandUriShorthand,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandUriShorthand(snap, 'bigBedLocation')
}

/**
 * #config BigBedAdapter
 * #trackType FeatureTrack
 * #fileFormat feature | BigBed
 * Reads BigBed files, the indexed binary form of BED.
 *
 * #example
 * ```js
 * {
 *   type: 'BigBedAdapter',
 *   uri: 'https://example.com/features.bb',
 * }
 * ```
 */
const BigBedAdapter = ConfigurationSchema(
  'BigBedAdapter',
  {
    /**
     * #slot
     * location of the BigBed file. The file has an index and summary zoom
     * levels built in, so there is no separate index to configure.
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
    closed: true,

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

export type BigBedAdapterConfig = Instance<typeof BigBedAdapter>

export default BigBedAdapter
