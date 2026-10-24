import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PileupBasesUnmodified
 * #category display
 * The pileup's `bases.unmodified` layer: the unmodified side of the
 * `modifications` and `bisulfite` fields, in blue. Under `modifications` it
 * paints every cytosine in the `context` a read's 5mC or 5hmC calls left
 * implicit, the methylation view, and each other call more likely
 * unmodified; the probability floor does not apply.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: {
 *     bases: {
 *       show: true,
 *       encoding: { color: 'modifications' },
 *       unmodified: { show: true },
 *     },
 *   },
 * }
 * ```
 */
export const pileupBasesUnmodifiedConfigSchema = ConfigurationSchema(
  'PileupBasesUnmodified',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description:
        'paint the unmodified side blue under the modifications and bisulfite fields',
    },
  },
  { closed: true },
)
