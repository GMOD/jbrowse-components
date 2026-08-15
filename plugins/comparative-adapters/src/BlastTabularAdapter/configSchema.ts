import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pairwiseAssemblyFields } from '../pairwiseAssemblyFields.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BlastTabularAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | BLAST tabular
 *
 * #example
 * The default `columns` are BLAST's own `-outfmt 6` order, so a file produced
 * without custom columns needs only the two assemblies naming which side is
 * which:
 * ```js
 * {
 *   type: 'BlastTabularAdapter',
 *   blastTableLocation: { uri: 'https://example.com/hits.tsv' },
 *   assemblyNames: ['grape', 'peach'],
 *   queryAssembly: 'grape',
 *   targetAssembly: 'peach',
 * }
 * ```
 *
 * #example custom outfmt
 * If you passed your own column list to `-outfmt`, repeat it here exactly.
 * `qseqid sseqid qstart qend sstart send` must be among them; the rest are read
 * where present:
 * ```js
 * {
 *   type: 'BlastTabularAdapter',
 *   blastTableLocation: { uri: 'https://example.com/hits.tsv' },
 *   assemblyNames: ['grape', 'peach'],
 *   columns: 'qseqid sseqid qstart qend sstart send evalue',
 * }
 * ```
 */

const BlastTabularAdapter = ConfigurationSchema(
  'BlastTabularAdapter',
  {
    ...pairwiseAssemblyFields,

    /**
     * #slot
     * location of the BLAST tabular output (`-outfmt 6` or `7`). Set `columns`
     * to match if the run used a custom column list.
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

export type BlastTabularAdapterConfig = Instance<typeof BlastTabularAdapter>

export default BlastTabularAdapter
