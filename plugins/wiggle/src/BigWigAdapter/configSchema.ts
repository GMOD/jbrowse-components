import { ConfigurationSchema } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BigWigAdapter
 * used to load BigWig or BigBed quantitative signal files
 *
 * #example
 * ```js
 * {
 *   type: 'BigWigAdapter',
 *   uri: 'https://example.com/coverage.bw',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bigWigLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const BigWigAdapter = ConfigurationSchema(
  'BigWigAdapter',
  {
    /**
     * #slot
     */
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot
     * added as feature.get('source') on all features
     */
    source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
    },

    /**
     * #slot
     */
    resolutionMultiplier: {
      type: 'number',
      defaultValue: 1,
      description:
        'Initial resolution multiplier, <1 is higher resolution, >1 is lower resolution',
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
     *   "type": "BigWigAdapter",
     *   "uri": "yourfile.bw"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type BigWigAdapterConfig = Instance<typeof BigWigAdapter>

export default BigWigAdapter
