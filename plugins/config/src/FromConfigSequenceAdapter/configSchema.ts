import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config FromConfigSequenceAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat inline | Inline sequence | Each feature's `seq` holds the bases for its region
 * Supplies a reference sequence inline in the config, as features whose `seq`
 * holds the bases for each region.
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
     * leave unset, so the adapter cache keys on a hash of the config and
     * changed features are a new adapter. Code that builds a large config sets
     * it with `withAdapterId`, which stamps that hash in. A hand-written value
     * replaces the hash, so the same value over different features serves the
     * first ones
     */
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     * one entry per reference sequence, each with a `uniqueId`, `refName`,
     * `start`, `end`, and a `seq` string holding the bases for that span. The
     * config holds the bases, so this suits small sequences — a plasmid, a
     * test contig — not a genome.
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,
    closed: true,
    retired: { featureClass: () => ({}) },
  },
)

export interface FromConfigSequenceAdapterConfig extends Instance<
  typeof sequenceConfigSchema
> {}

export default sequenceConfigSchema
