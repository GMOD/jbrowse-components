import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GtfAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GtfAdapter = ConfigurationSchema(
  'GtfAdapter',
  {
    /**
     * #slot
     */
    gtfLocation: {
      type: 'fileLocation',
      description: 'path to gtf file, also allows for gzipped gtf',
      defaultValue: {
        uri: '/path/to/my.gtf',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    aggregateField: {
      type: 'string',
      description:
        'field used to aggregate multiple transcripts into a single parent gene feature',
      defaultValue: 'gene_name',
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
     *   "type": "GtfAdapter",
     *   "uri": "yourfile.gtf"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            gtfLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default GtfAdapter
