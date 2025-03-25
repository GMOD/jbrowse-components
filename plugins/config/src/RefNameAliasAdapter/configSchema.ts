import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config RefNameAliasAdapter
 * can read "chromAliases" type files from UCSC or any tab separated file of
 * refName aliases
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const RefNameAliasAdapter = ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    /**
     * #slot
     */
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/aliases.txt',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * by default, the "ref names that match the fasta" are assumed to be in the
     * first column (0), change this variable if needed
     */
    refNameColumn: {
      type: 'number',
      defaultValue: 0,
    },

    /**
     * #slot
     * refNameColumnHeaderName
     */
    refNameColumnHeaderName: {
      type: 'string',
      description:
        'alternative to refNameColumn, instead looks at header (starts with # and finds column name)',
      defaultValue: '',
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
     *   "type": "RefNameAliasAdapter",
     *   "uri": "yourfile.chromAlias.txt"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            location: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default RefNameAliasAdapter
