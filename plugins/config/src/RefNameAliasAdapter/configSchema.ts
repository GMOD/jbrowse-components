import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { normalizeUriSnapshot } from '../normalizeUriSnapshot.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const normalizeSnapshot = normalizeUriSnapshot

/**
 * #config RefNameAliasAdapter
 * can read "chromAliases" type files from UCSC or any tab separated file of
 * refName aliases
 *
 * #example
 * Goes on an ASSEMBLY, under `refNameAliases` — not on a track. Writing
 * `refNameAliases: { uri: '...' }` is shorthand for exactly this adapter:
 * ```js
 * {
 *   name: 'hg38',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'hg38-ReferenceSequenceTrack',
 *     adapter: {
 *       type: 'BgzipFastaAdapter',
 *       uri: 'https://example.com/hg38.fa.gz',
 *     },
 *   },
 *   refNameAliases: {
 *     adapter: {
 *       type: 'RefNameAliasAdapter',
 *       uri: 'https://example.com/hg38.chromAlias.txt',
 *     },
 *   },
 * }
 * ```
 *
 * #example named column
 * When the primary column — the one whose values match your FASTA — is not the
 * first, name it. `refNameColumnHeaderName` reads the last `#`-prefixed line as
 * the header; `refNameColumn` takes a zero-based index instead.
 * ```js
 * {
 *   name: 'hg38',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'hg38-ReferenceSequenceTrack',
 *     adapter: {
 *       type: 'BgzipFastaAdapter',
 *       uri: 'https://example.com/hg38.fa.gz',
 *     },
 *   },
 *   refNameAliases: {
 *     adapter: {
 *       type: 'RefNameAliasAdapter',
 *       uri: 'https://example.com/aliases.txt',
 *       refNameColumnHeaderName: 'ucsc',
 *     },
 *   },
 * }
 * ```
 */
const RefNameAliasAdapter = ConfigurationSchema(
  'RefNameAliasAdapter',
  {
    /**
     * #slot
     * location of the alias table: a UCSC `chromAlias.txt`, or any
     * tab-separated file whose rows each list the alternate names of one
     * reference sequence (`chr1<TAB>1<TAB>NC_000001.11`). It is what lets a
     * `1`-named file load against a `chr1`-named assembly.
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
