import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BigBedAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BigBedAdapter = ConfigurationSchema(
  'BigBedAdapter',
  {
    /**
     * #slot
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
     *   "type": "BigBedAdapter",
     *   "uri": "yourfile.bigBed"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            bigBedLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default BigBedAdapter
