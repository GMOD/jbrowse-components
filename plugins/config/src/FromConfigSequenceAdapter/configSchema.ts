import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigSequenceAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat inline | Inline sequence | Each feature's `seq` holds the bases for its region
 * supplies reference sequence inline in the config; each feature's `seq` holds
 * the bases for its region
 *
 * #example
 * Used as the adapter of an assembly's `sequence` (a `ReferenceSequenceTrack`):
 * ```js
 * {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'my_refseq',
 *   adapter: {
 *     type: 'FromConfigSequenceAdapter',
 *     features: [
 *       { uniqueId: 'ctgA', refName: 'ctgA', start: 0, end: 10, seq: 'ATGCATGCAT' },
 *     ],
 *   },
 * }
 * ```
 */

const sequenceConfigSchema = ConfigurationSchema(
  'FromConfigSequenceAdapter',
  {
    /**
     * #slot
     * stable identifier used as the adapter cache key; avoids hashing the
     * (potentially large) features array. optional — falls back to hash.
     */
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     * one entry per reference sequence, each with a `uniqueId`, `refName`,
     * `start`, `end`, and a `seq` string holding the bases for that span. The
     * bases live in the config, so this is for small sequences — a plasmid, a
     * test contig — not a genome.
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,
  },
)

export default sequenceConfigSchema
