import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config NCListAdapter
 */

const NCListAdapter = ConfigurationSchema(
  'NCListAdapter',
  {
    /**
     * #slot
     * URL of a JBrowse 1 NCList `trackData.json`, with `{refseq}` standing in
     * for the reference sequence name — the per-reference directory layout
     * `flatfile-to-json.pl` and `biodb-to-json.pl` write.
     */
    rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    },
  },
  {
    explicitlyTyped: true,
  },
)
export default NCListAdapter
