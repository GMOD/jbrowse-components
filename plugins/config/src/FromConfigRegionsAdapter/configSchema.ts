import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigRegionsAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat inline | Inline regions | refNames and sizes only, no sequence
 * used for specifying refNames+sizes of an assembly
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
  },
)
export default regionsConfigSchema
