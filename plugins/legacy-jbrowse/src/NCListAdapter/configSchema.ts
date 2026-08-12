import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config NCListAdapter
 *
 * #example
 * Reads a JBrowse 1 NCList store in place, so an existing JBrowse 1 instance's
 * data serves JBrowse 2 without re-processing. `{refseq}` in the URL template
 * is substituted per sequence, which is how the store is laid out on disk:
 * ```js
 * {
 *   type: 'NCListAdapter',
 *   rootUrlTemplate: {
 *     uri: 'https://example.com/jbrowse1/data/tracks/genes/{refseq}/trackData.json',
 *   },
 * }
 * ```
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
