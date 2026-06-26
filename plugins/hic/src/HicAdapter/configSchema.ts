import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HicAdapter
 * #category adapter
 * #trackType HicTrack
 * used to load Hi-C contact matrix data from a `.hic` file
 *
 * #example
 * ```js
 * {
 *   type: 'HicAdapter',
 *   uri: 'https://example.com/map.hic',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        hicLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const HicAdapter = ConfigurationSchema(
  'HicAdapter',
  {
    /**
     * #slot
     */
    hicLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hic',
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
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "HicAdapter",
     *   "uri": "file.hic",
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default HicAdapter
