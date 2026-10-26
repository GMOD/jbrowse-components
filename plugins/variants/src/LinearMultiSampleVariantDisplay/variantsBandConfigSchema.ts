import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  featureDescriptionLabelConfigSchema,
  featureNameLabelConfigSchema,
} from '@jbrowse/plugin-canvas'

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
     * #slot labels
     * Letter the marks as a `LinearVariantDisplay` letters the same record:
     * `labels.name`, each record's ID, and `labels.description`, each a
     * [](/docs/config/featurenamelabel) and
     * [](/docs/config/featuredescriptionlabel) object. The band's fit ladder
     * decides what it has room for: descriptions drop first, then IDs thin,
     * then drop.
     */
    labels: ConfigurationSchema(
      'VariantsBandLabels',
      {
        name: featureNameLabelConfigSchema,
        description: featureDescriptionLabelConfigSchema,
      },
      { closed: true, plot: true },
    ),
  },
  {
    closed: true,
    plot: true,
    // the five-value label mode share links still carry
    retired: {
      showLabels: mode => {
        const labels = {
          ...(mode === 'none' || mode === 'description'
            ? { name: { show: false } }
            : {}),
          ...(mode === 'none' || mode === 'name'
            ? { description: { show: false } }
            : {}),
        }
        return Object.keys(labels).length > 0 ? { labels } : {}
      },
    },
  },
)
