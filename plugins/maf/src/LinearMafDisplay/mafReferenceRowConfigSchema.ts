import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MafReferenceRow
 * #category display
 * The MAF display's `alignments.reference` part: the reference species' own
 * row, which every other row is scored against. Under mismatch coloring it
 * draws one constant color, and under codon coloring it carries the reference
 * amino acids. The FASTA export keeps it either way.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { reference: { show: false } } }
 * ```
 */
export const mafReferenceRowConfigSchema = ConfigurationSchema(
  'MafReferenceRow',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the reference species as a separate row',
    },
  },
  { closed: true, plot: true },
)
