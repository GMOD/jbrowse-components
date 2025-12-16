import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config BamAdapter
 * used to configure BAM adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'BamAdapter',
  {
    /**
     * #slot
     */
    bamLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bam',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('BamIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
    },

    /**
     * #slot sequenceAdapter
     * optional reference sequence adapter, used for calculating SNPs
     */
    sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.bam.bai:
     * ```json
     * {
     *   "type": "BamAdapter",
     *   "uri": "yourfile.bam"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            bamLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              location: {
                uri: `${snap.uri}.bai`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default configSchema
