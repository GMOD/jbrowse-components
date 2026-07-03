import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BigWigAdapter
 * #trackType QuantitativeTrack
 * used to load BigWig quantitative signal files
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
      description:
        'Label added to all features; used as the subtrack/row name when this adapter is a subadapter of a multi-wiggle track',
    },

    /**
     * #slot
     */
    resolutionMultiplier: {
      type: 'number',
      defaultValue: 1,
      description:
        'Resolution multiplier applied to every fetch: <1 fetches more points (higher resolution), >1 fetches fewer (e.g. 2 = half as many points)',
      advanced: true,
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
