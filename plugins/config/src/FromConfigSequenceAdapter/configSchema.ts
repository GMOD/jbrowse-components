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
     */
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
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
