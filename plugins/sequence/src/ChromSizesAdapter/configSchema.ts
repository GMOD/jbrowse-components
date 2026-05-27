import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ChromSizesAdapter
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        chromSizesLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const ChromSizesAdapter = ConfigurationSchema(
  'ChromSizesAdapter',
  {
    /**
     * #slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/species.chrom.sizes',
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
     *   "type": "ChromSizesAdapter",
     *   "uri": "yourfile.chrom.sizes"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default ChromSizesAdapter
