import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config NcbiSequenceReportAliasAdapter
 * can read "sequence_report.tsv" type files from NCBI
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        location: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const NcbiSequenceReportAliasAdapterConfigSchema = ConfigurationSchema(
  'NcbiSequenceReportAliasAdapter',
  {
    /**
     * #slot
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
