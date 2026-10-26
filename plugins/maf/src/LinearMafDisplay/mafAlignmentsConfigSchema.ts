import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULTS } from './displayDefaults.ts'
import { mafBasesConfigSchema } from './mafBasesConfigSchema.ts'
import { mafMismatchesConfigSchema } from './mafMismatchesConfigSchema.ts'
import { mafPartConfigSchema } from './mafPartConfigSchema.ts'
import { mafReferenceRowConfigSchema } from './mafReferenceRowConfigSchema.ts'

/**
 * #config MafAlignments
 * #category display
 * The MAF display's `alignments` setting: the per-species rows, the band that
 * takes the height the bands above it leave, and the layers drawn over the
 * fill `encoding.color` gives them. Letters keep the case the file gives
 * them, lowercase being soft-masked repeat in a UCSC alignment.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { inversions: { show: true } } }
 * ```
 */
export const mafAlignmentsConfigSchema = ConfigurationSchema(
  'MafAlignments',
  {
    /**
     * #slot
     * When off, only the bands above the rows render.
     */
    show: {
      type: 'boolean',
      defaultValue: DEFAULTS.showAlignments,
      description: 'show the per-species alignment rows',
    },
    /**
     * #slot
     */
    rowProportion: {
      type: 'number',
      defaultValue: DEFAULTS.rowProportion,
      description: 'fraction of the row height each glyph fills',
    },
    /**
     * #slot mismatches
     * `show` draws each base differing from the reference, with insertion
     * markers and deletion counts; on by default.
     */
    mismatches: mafMismatchesConfigSchema,
    /**
     * #slot bases
     * The per-position layer: every base, or each codon's amino-acid change.
     */
    bases: mafBasesConfigSchema,
    /**
     * #slot inversions
     * `show` hatches each block a species aligns on the other strand from the
     * rest of its blocks on that source chromosome.
     */
    inversions: mafPartConfigSchema,
    /**
     * #slot frames
     * `show` draws each species' CDS reading frames from the MAF adapter's
     * `framesAdapter` (UCSC `mafFrames`) as a strip over its row; no effect
     * without one.
     */
    frames: mafPartConfigSchema,
    /**
     * #slot reference
     * `show` gives the reference species, which every other row is scored
     * against, a row of its own; on by default.
     */
    reference: mafReferenceRowConfigSchema,
  },
  { closed: true, plot: true },
)
