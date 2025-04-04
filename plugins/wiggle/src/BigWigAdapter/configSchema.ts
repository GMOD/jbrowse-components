import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BigWigAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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
      description: 'Initial resolution multiplier',
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
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            bigWigLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default BigWigAdapter
