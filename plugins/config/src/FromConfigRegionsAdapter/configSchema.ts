import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config FromConfigRegionsAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat inline | Inline regions | refNames and sizes only, no sequence
 * Supplies an assembly's reference names and sizes inline in the config, with
 * no sequence.
 *
 * #example
 * Supplies refNames+sizes with no sequence, as the adapter of an assembly's
 * `sequence` (a `ReferenceSequenceTrack`):
 * ```js
 * {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'my_refseq',
 *   adapter: {
 *     type: 'FromConfigRegionsAdapter',
 *     features: [
 *       { uniqueId: 'ctgA', refName: 'ctgA', start: 0, end: 50000 },
 *       { uniqueId: 'ctgB', refName: 'ctgB', start: 0, end: 6079 },
 *     ],
 *   },
 * }
 * ```
 */

const regionsConfigSchema = ConfigurationSchema(
  'FromConfigRegionsAdapter',
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
     * `start: 0` and `end` set to that sequence's length. This is what defines
     * the assembly's reference names and sizes; no bases are supplied, so
     * base-level views are empty.
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
export interface FromConfigRegionsAdapterConfig extends Instance<
  typeof regionsConfigSchema
> {}

export default regionsConfigSchema
