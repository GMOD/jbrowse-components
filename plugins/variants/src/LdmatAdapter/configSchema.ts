import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LdmatAdapter
 *
 * Adapter for reading LD matrices stored in ldmat HDF5 format.
 * See: https://github.com/G2Lab/ldmat
 *
 * The ldmat format stores LD matrices efficiently with:
 * - Chunked organization by genomic position
 * - Gzip compression with quantization
 * - Support for range and position-based queries
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const LdmatAdapter = ConfigurationSchema(
  'LdmatAdapter',
  {
    /**
     * #slot
     * Location of the ldmat HDF5 file (.h5)
     */
    ldmatLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/ld.h5',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            ldmatLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default LdmatAdapter
