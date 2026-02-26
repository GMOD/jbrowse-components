import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PlinkLDAdapter
 *
 * Adapter for reading pre-computed LD data from PLINK --r2 output.
 * Loads the entire file into memory - suitable for small to medium files.
 *
 * For large files, use PlinkLDTabixAdapter with tabix indexing.
 *
 * Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2
 * Optional columns: DP (D'), MAF_A, MAF_B
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const PlinkLDAdapter = ConfigurationSchema(
  'PlinkLDAdapter',
  {
    /**
     * #slot
     * Location of the PLINK LD file (.ld or .ld.gz)
     */
    ldLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/plink.ld',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * Preprocessor to allow minimal config:
     *
     * ```json
     * {
     *   "type": "PlinkLDAdapter",
     *   "uri": "plink.ld"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            ldLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default PlinkLDAdapter
