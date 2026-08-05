import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HicAdapter
 * #category adapter
 * #trackType HicTrack
 * #fileFormat hic | .hic contact matrix
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
     * location of the `.hic` contact matrix (Juicer / Juicebox format). It
     * stores every resolution and its own index, so there is nothing else to
     * configure — the display picks a bin size from the current zoom.
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
