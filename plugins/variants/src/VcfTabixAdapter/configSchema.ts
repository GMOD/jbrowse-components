import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config VcfTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const VcfTabixAdapter = ConfigurationSchema(
  'VcfTabixAdapter',
  {
    /**
     * #slot
     */
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.vcf.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('VcfIndex', {
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
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     */
    samplesTsvLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/samples.tsv',
        description:
          'tsv with header like name\tpopulation\tetc. where the first column is required, and is the sample names',
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
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.vcf.gz.tbi:
     *
     * ```json
     * {
     *   "type": "VcfTabixAdapter",
     *   "uri": "yourfile.vcf.gz",
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            vcfGzLocation: {
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

export default VcfTabixAdapter
