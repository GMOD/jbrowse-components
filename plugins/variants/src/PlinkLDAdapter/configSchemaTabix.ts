import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config PlinkLDTabixAdapter
 *
 * Adapter for reading pre-computed LD data from PLINK --r2 output (tabix-indexed).
 *
 * The input file should be bgzipped and tabix-indexed:
 *   bgzip plink.ld
 *   tabix -s1 -b2 -e2 plink.ld.gz
 *
 * Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2
 * Optional columns: DP (D'), MAF_A, MAF_B
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const PlinkLDTabixAdapter = ConfigurationSchema(
  'PlinkLDTabixAdapter',
  {
    /**
     * #slot
     * Location of the bgzipped PLINK LD file (.ld.gz)
     */
    ldLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/plink.ld.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('PlinkLDTabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/plink.ld.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
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
     *   "type": "PlinkLDTabixAdapter",
     *   "uri": "plink.ld.gz"
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
            index: {
              location: {
                uri: `${snap.uri}.tbi`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default PlinkLDTabixAdapter
