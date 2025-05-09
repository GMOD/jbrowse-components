import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ChromSizesAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            chromSizesLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default ChromSizesAdapter
