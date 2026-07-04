import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FromConfigRegionsAdapter
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
export default regionsConfigSchema
