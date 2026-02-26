import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BlastTabularAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BlastTabularAdapter = ConfigurationSchema(
  'BlastTabularAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Query assembly is the first value in the array, target assembly is the second',
    },

    /**
     * #slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    },
    /**
     * #slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    },
    /**
     * #slot
     */
    blastTableLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/blastTable.tsv',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    columns: {
      type: 'string',
      description:
        'Optional space-separated column name list. If custom columns were used in outfmt, enter them here exactly as specified in the command. At least qseqid, sseqid, qstart, qend, sstart, and send are required',
      defaultValue:
        'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore',
    },
  },
  { explicitlyTyped: true },
)

export default BlastTabularAdapter
