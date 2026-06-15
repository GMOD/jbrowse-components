import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { normalizeUriSnapshot } from '../normalizeUriSnapshot.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config RefNameAliasAdapter
 * can read "chromAliases" type files from UCSC or any tab separated file of
 * refName aliases
 */

export const normalizeSnapshot = normalizeUriSnapshot

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
      advanced: true,
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
      advanced: true,
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
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type RefNameAliasAdapterConfig = Instance<typeof RefNameAliasAdapter>

export default RefNameAliasAdapter
