import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config Gff3Adapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const Gff3Adapter = ConfigurationSchema(
  'Gff3Adapter',
  {
    /**
     * #slot
     */
    gffLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gff',
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
     *
     * ```json
     * {
     *   "type": "Gff3Adapter",
     *   "uri": "yourfile.gff3",
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            gffLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default Gff3Adapter
