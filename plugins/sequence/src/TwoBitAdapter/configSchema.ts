import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config TwoBitAdapter
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        twoBitLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        ...(snap.chromSizes
          ? {
              chromSizesLocation: {
                uri: snap.chromSizes,
                baseUri: snap.baseUri,
              },
            }
          : {}),
      }
    : snap
}

const TwoBitAdapter = ConfigurationSchema(
  'TwoBitAdapter',
  {
    /**
     * #slot
     */
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.2bit',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/default.chrom.sizes',
        locationType: 'UriLocation',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config (note that adding chromSizes improves speed, otherwise has to read a lot of the twobit file to calculate chromosome names and sizes):
     *
     * ```json
     * {
     *   "type": "TwoBitAdapter",
     *   "uri": "yourfile.2bit"
     *   "chromSizes":"yourfile.chrom.sizes"
     * }
     *
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default TwoBitAdapter
