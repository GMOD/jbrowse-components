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
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my/aliases.txt',
      },
      type: 'fileLocation',
    },
    /**
     * #slot
     * by default, the "ref names that match the fasta" are assumed to be in the
     * first column (0), change this variable if needed
     */
    refNameColumn: {
      defaultValue: 0,
      type: 'number',
    },
  },
  { explicitlyTyped: true },
)

export default RefNameAliasAdapter
