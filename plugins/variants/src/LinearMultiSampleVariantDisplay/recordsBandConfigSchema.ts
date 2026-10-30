import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  featureDescriptionLabelConfigSchema,
  featureNameLabelConfigSchema,
} from '@jbrowse/plugin-features'

import { DEFAULT_RECORDS_GROW_MAX_HEIGHT } from './variantTopBands.ts'

/**
 * #config RecordsBand
 * #category display
 * The multi-sample variant display's `records` band: the VCF's records above
 * the genotype rows, laid out as a `LinearVariantDisplay` lays them out, so a
 * nested structural variant stacks under the one holding it. Each record takes
 * the color its alt cells take. The band grows to its stack, up to
 * `growMaxHeight`; past that it fits the stack in as a feature track fits
 * its display: descriptions go, then names thin and go, then boxes shrink. Hovering a
 * record reports it and clicking opens its details. At genomic positions only.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', records: { show: true } }
 * ```
 */
export const recordsBandConfigSchema = ConfigurationSchema(
  'RecordsBand',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description:
        'draw the records themselves above the genotype rows, at their genomic positions',
    },
    /**
     * #slot
     */
    growMaxHeight: {
      type: 'number',
      defaultValue: DEFAULT_RECORDS_GROW_MAX_HEIGHT,
      description:
        'ceiling in pixels on the band, which grows to its stack of records and takes that height from the rows',
    },
    /**
     * #slot labels
     * `labels.name`, each record's ID, and `labels.description`, each a
     * [](/docs/config/featurenamelabel) and
     * [](/docs/config/featuredescriptionlabel) object.
     */
    labels: ConfigurationSchema(
      'RecordsBandLabels',
      {
        /**
         * #slot labels.name
         * Each record's ID.
         */
        name: featureNameLabelConfigSchema,
        /**
         * #slot labels.description
         * The line under each ID.
         */
        description: featureDescriptionLabelConfigSchema,
      },
      { closed: true, plot: true },
    ),
  },
  { closed: true, plot: true },
)
