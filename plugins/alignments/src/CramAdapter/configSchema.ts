import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config CramAdapter
 * used to configure CRAM adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'CramAdapter',
  {
    /**
     * #slot fetchSizeLimit
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
    },

    /**
     * #slot cramLocation
     */
    cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot craiLocation
     */
    craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * preprocessor to allow minimal config, assumes yourfile.cram.crai:
     *
     * ```json
     * {
     *   "type": "CramAdapter",
     *   "uri": "yourfile.cram"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            cramLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            craiLocation: {
              uri: `${snap.uri}.crai`,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)
export default configSchema
