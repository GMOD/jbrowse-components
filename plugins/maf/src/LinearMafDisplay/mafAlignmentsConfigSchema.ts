import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULTS } from './displayDefaults.ts'
import { mafPartConfigSchema } from './mafPartConfigSchema.ts'
import { mafReferenceRowConfigSchema } from './mafReferenceRowConfigSchema.ts'

/**
 * #config MafAlignments
 * #category display
 * The MAF display's `alignments` setting: the per-species rows, the band that
 * takes the height the bands above it leave, and the parts drawn over them.
 * Letters draw over every cell `encoding.color` paints with its base's color,
 * so `encoding: { color: 'base' }` letters every base and `mismatch` only
 * the mismatches; they keep the case the file gives them, lowercase being
 * soft-masked repeat in a UCSC alignment.
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
