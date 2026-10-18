import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { DEFAULTS } from './displayDefaults.ts'

/**
 * #config MafAlignments
 * #category display
 * The MAF display's `alignments` setting: the per-species rows, the band
 * that takes the height the bands above it leave, and what each row draws.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { showAllLetters: true } }
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
     * #slot
     */
    showAllLetters: {
      type: 'boolean',
      defaultValue: DEFAULTS.showAllLetters,
      description: "draw every base's letter, not only the mismatches'",
    },
    /**
     * #slot
     */
    showAsUpperCase: {
      type: 'boolean',
      defaultValue: DEFAULTS.showAsUpperCase,
      description: 'uppercase all base letters',
    },
    /**
     * #slot
     * Inverted blocks get a diagonal hatch.
     */
    showInversions: {
      type: 'boolean',
      defaultValue: DEFAULTS.showInversions,
      description: 'hatch strand-flipped (inverted) alignment blocks',
    },
    /**
     * #slot
     * The per-species CDS reading frames from the MAF adapter's
     * `annotationAdapter` (UCSC `mafFrames`). No effect without one.
     */
    showAnnotations: {
      type: 'boolean',
      defaultValue: DEFAULTS.showAnnotations,
      description: 'show the per-species CDS reading-frame overlay',
    },
  },
  { closed: true, plot: true },
)
