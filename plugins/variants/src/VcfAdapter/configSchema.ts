import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? { ...snap, vcfLocation: { uri: snap.uri, baseUri: snap.baseUri } }
    : snap
}

/**
 * #config VcfAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const VcfAdapter = ConfigurationSchema(
  'VcfAdapter',
  {
    /**
     * #slot
     */
    vcfLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.vcf',
        locationType: 'UriLocation',
      },
    },
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
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "VcfAdapter",
     *   "uri": "yourfile.vcf"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default VcfAdapter
