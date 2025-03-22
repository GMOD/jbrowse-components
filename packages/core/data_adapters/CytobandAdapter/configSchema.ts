import { ConfigurationSchema } from '../../configuration'

/**
 * #config CytobandAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'CytobandAdapter',
  {
    /**
     * #slot
     */
    cytobandLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/cytoband.txt.gz',
      },
    },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            cytobandLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default configSchema
