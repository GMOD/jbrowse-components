import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config NcbiSequenceReportAliasAdapter
 * can read "sequence_report.tsv" type files from NCBI
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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

    useNameOverride: {
      type: 'boolean',
      defaultValue: true,
      description:
        'forces usage of the UCSC names over the NCBI style names from a FASTA',
    },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap => {
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

export default NcbiSequenceReportAliasAdapterConfigSchema
