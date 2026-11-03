import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PileupBasesUnmodified
 * #category display
 * The pileup's `bases.unmodified` layer: the unmodified side of the
 * `modifications` and `bisulfite` fields, in blue. Under `modifications` it is
 * the methylation view: every cytosine in the `context`, those a read's 5mC
 * calls left implicit included, is painted 5mC, 5hmC or unmethylated, with no
 * probability floor. Other modification types draw as they do without it.
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
