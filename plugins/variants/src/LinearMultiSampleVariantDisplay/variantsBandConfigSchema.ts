import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { SHOW_LABELS_MODES } from '@jbrowse/plugin-canvas'

import { DEFAULT_VARIANT_LANE_HEIGHT } from './variantTopBands.ts'

/**
 * #config VariantsBand
 * #category display
 * The multi-sample variant display's `variants` setting: a
 * `LinearVariantDisplay`-style band above the genotype rows, one mark per
 * record at its genomic span, colored by whatever "Color by → Cells" is set
 * to. Overlapping records stack while the band has room and share a row once
 * it has not; hovering a mark reports the record, clicking opens its details,
 * and right-clicking opens the menu a genotype cell does. At genomic positions
 * only.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', variants: { show: true } }
 * ```
 */
export const variantsBandConfigSchema = ConfigurationSchema(
  'VariantsBand',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description:
        'draw the variants themselves above the genotype rows, at their genomic positions',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: DEFAULT_VARIANT_LANE_HEIGHT,
      description: 'height of the band in pixels, taken from the rows',
    },
    /**
     * #slot
     * Letter the marks with each record's VCF ID and/or its description, as a
     * `LinearVariantDisplay` letters the same record. That display's fit
     * ladder decides what the band has room for: descriptions drop first, then
     * IDs are thinned, then dropped.
     */
    showLabels: {
      type: 'stringEnum',
      model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
      defaultValue: 'auto',
      description:
        "label text drawn beside each mark: the record's ID and/or its description, in plugin-canvas's own vocabulary. 'auto' admits both, the band's collision cull deciding what fits",
    },
  },
  { closed: true, plot: true },
)
