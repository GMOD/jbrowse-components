import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULTS } from './displayDefaults.ts'

/**
 * #config MafInversions
 * #category display
 * The MAF display's `alignments.inversions` part: a diagonal hatch over each
 * block a species aligns on the other strand from the rest of its blocks on
 * that source chromosome.
 */
const mafInversionsConfigSchema = ConfigurationSchema(
  'MafInversions',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'hatch strand-flipped (inverted) alignment blocks',
    },
  },
  { closed: true, plot: true },
)

/**
 * #config MafFrames
 * #category display
 * The MAF display's `alignments.frames` part: each species' CDS reading
 * frames from the MAF adapter's `framesAdapter` (UCSC `mafFrames`), as a
 * strip over its row. No effect without one.
 */
const mafFramesConfigSchema = ConfigurationSchema(
  'MafFrames',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: "draw each species' CDS reading frames over its row",
    },
  },
  { closed: true, plot: true },
)

/**
 * #config MafReferenceRow
 * #category display
 * The MAF display's `alignments.reference` part: the reference species' own
 * row, which every other row is scored against. Off by default, since under
 * every color but `base` it draws one constant color; the FASTA export keeps
 * it either way.
 */
const mafReferenceRowConfigSchema = ConfigurationSchema(
  'MafReferenceRow',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'give the reference species a row of its own',
    },
  },
  { closed: true, plot: true },
)

/**
 * #config MafAlignments
 * #category display
 * The MAF display's `alignments` setting: the per-species rows, the band that
 * takes the height the bands above it leave, and the parts drawn over them.
 * Letters draw over every cell `color` paints with its base's color, so
 * `color: 'base'` letters every base and `mismatch` only the mismatches; they
 * keep the case the file gives them, lowercase being soft-masked repeat in a
 * UCSC alignment.
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
     */
    inversions: mafInversionsConfigSchema,
    /**
     * #slot frames
     */
    frames: mafFramesConfigSchema,
    /**
     * #slot reference
     */
    reference: mafReferenceRowConfigSchema,
  },
  { closed: true, plot: true },
)
