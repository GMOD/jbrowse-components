import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { normalizeUriSnapshot } from '../normalizeUriSnapshot.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const normalizeSnapshot = normalizeUriSnapshot

/**
 * #config NcbiSequenceReportAliasAdapter
 * can read "sequence_report.tsv" type files from NCBI
 *
 * #example
 * Goes on an ASSEMBLY, under `refNameAliases` — not on a track. The file ships
 * beside any RefSeq assembly on NCBI datasets and aliases the RefSeq, GenBank
 * and UCSC-style names of every sequence at once, so it replaces a
 * hand-maintained chromAlias table:
 * ```js
 * {
 *   name: 'GCF_000001405.40',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'GCF_000001405.40-ReferenceSequenceTrack',
 *     adapter: {
 *       type: 'BgzipFastaAdapter',
 *       uri: 'https://example.com/GCF_000001405.40.fa.gz',
 *     },
 *   },
 *   refNameAliases: {
 *     adapter: {
 *       type: 'NcbiSequenceReportAliasAdapter',
 *       uri: 'https://example.com/GCF_000001405.40_sequence_report.tsv',
 *     },
 *   },
 * }
 * ```
 *
 * #example keeping the FASTA's own names
 * With an NCBI FASTA (`NC_000001.11`), the default displays UCSC-style names
 * (`chr1`) while still fetching bases under the accession. Set
 * `useNameOverride: false` to display the accessions instead, with `chr1` left
 * searchable as an alias:
 * ```js
 * {
 *   name: 'GCF_000001405.40',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'GCF_000001405.40-ReferenceSequenceTrack',
 *     adapter: {
 *       type: 'BgzipFastaAdapter',
 *       uri: 'https://example.com/GCF_000001405.40.fa.gz',
 *     },
 *   },
 *   refNameAliases: {
 *     adapter: {
 *       type: 'NcbiSequenceReportAliasAdapter',
 *       uri: 'https://example.com/GCF_000001405.40_sequence_report.tsv',
 *       useNameOverride: false,
 *     },
 *   },
 * }
 * ```
 */
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
