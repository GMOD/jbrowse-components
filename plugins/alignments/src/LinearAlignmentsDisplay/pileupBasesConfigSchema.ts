import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'

import { alignmentsBaseColorConfigSchema } from './alignmentsBaseColorConfigSchema.ts'

/**
 * #config PileupBases
 * #category display
 * The pileup's `bases` layer, a cell per base over the reads: `show` turns it
 * on and `encoding.color` names what it paints. It draws while `show` is on
 * and a field is named. Its `filter` picks the modification calls the
 * `modifications` and `bisulfite` fields paint.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { bases: { show: true, encoding: { color: 'baseQuality' } } },
 *   encoding: { color: 'tags.HP' },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: {
 *     bases: {
 *       show: true,
 *       encoding: { color: 'modifications' },
 *       filter: [
 *         { field: 'probability', gte: 0.5 },
 *         { field: 'code', oneOf: ['a'] },
 *       ],
 *     },
 *   },
 * }
 * ```
 */
export const pileupBasesConfigSchema = ConfigurationSchema(
  'PileupBases',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the per-base layer over the reads',
    },
    /**
     * #slot encoding
     * The layer's channels: `encoding.color`, the per-base variable.
     */
    encoding: ConfigurationSchema(
      'PileupBasesEncoding',
      {
        /**
         * #slot encoding.color
         * The per-base variable the layer paints.
         */
        color: alignmentsBaseColorConfigSchema,
      },
      encodingOptions,
    ),
    /**
     * #slot filter
     * The modification calls drawn, by `probability` (0 to 1), `context`
     * (`CG`, `CHG` or `CHH`) and `code` (`m`, `h`, `a`, ...). Unwritten, a
     * field keeps its default: `probability` at least 0.1, which only the
     * by-type view applies, `context` CG, which the methylation fill and
     * bisulfite read, and every code. An entry naming a field with no test,
     * `{ field: 'context' }`, drops that field's default.
     */
    filter: fieldPredicateList(),
  },
  { closed: true, plot: true },
)
