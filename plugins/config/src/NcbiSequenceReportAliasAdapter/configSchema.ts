import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { normalizeUriSnapshot } from '../normalizeUriSnapshot.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config NcbiSequenceReportAliasAdapter
 * can read "sequence_report.tsv" type files from NCBI
 *
 * #example
 * Used as an assembly's `refNameAliases`. The file ships beside any RefSeq
 * assembly on NCBI datasets, and aliases the RefSeq, GenBank and UCSC-style
 * names of every sequence at once:
 * ```js
 * {
 *   type: 'NcbiSequenceReportAliasAdapter',
 *   uri: 'https://example.com/GCF_000001405.40_sequence_report.tsv',
 * }
 * ```
 *
 * #example keeping the FASTA's own names
 * With an NCBI FASTA (`NC_000001.11`), the default shows UCSC-style names
 * (`chr1`) and fetches bases under the accession. Set `useNameOverride: false`
 * to display the accessions instead, with `chr1` still searchable as an alias.
 * ```js
 * {
 *   type: 'NcbiSequenceReportAliasAdapter',
 *   uri: 'https://example.com/GCF_000001405.40_sequence_report.tsv',
 *   useNameOverride: false,
 * }
 * ```
 */

export const normalizeSnapshot = normalizeUriSnapshot

const NcbiSequenceReportAliasAdapterConfigSchema = ConfigurationSchema(
  'NcbiSequenceReportAliasAdapter',
  {
    /**
     * #slot
     * location of the `sequence_report.tsv` NCBI publishes with an assembly. It
     * carries the RefSeq, GenBank and UCSC-style name of every sequence, so one
     * file aliases them all without hand-writing a chromAlias table.
     */
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/sequence_report.tsv',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot
     */
    useNameOverride: {
      type: 'boolean',
      defaultValue: true,
      description:
        'forces usage of the UCSC names over the NCBI style names from a FASTA',
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
     *   "type": "NcbiSequenceReportAliasAdapter",
     *   "uri": "sequence_report.tsv"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type NcbiSequenceReportAliasAdapterConfig = Instance<
  typeof NcbiSequenceReportAliasAdapterConfigSchema
>

export default NcbiSequenceReportAliasAdapterConfigSchema
