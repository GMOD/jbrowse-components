import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  featureDescriptionLabelConfigSchema,
  featureNameLabelConfigSchema,
} from '@jbrowse/plugin-features'

import { DEFAULT_RECORDS_GROW_MAX_HEIGHT } from './variantTopBands.ts'

/**
 * #config RecordsBand
 * #category display
 * The multi-sample variant display's `records` band: the VCF's structural
 * variants above the genotype rows, stacked as a `LinearVariantDisplay`
 * stacks them, so a nested SV sits under the one holding it. SNVs and small
 * indels are left out, so a region without SVs spends no height on it. A
 * record is colored by its SV type, keyed, or by `encoding.color` when that
 * is set, and lettered on one line with its ID, description and the share of
 * the samples shown as rows that carry it. The band grows to its stack, up to
 * `growMaxHeight`; past that names thin and go, then boxes shrink. Hovering a
 * record reports it and its carriers, and clicking opens its details. At
 * genomic positions only.
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
        'draw the structural variants themselves above the genotype rows, at their genomic positions',
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
     * `labels.name`, each record's ID, and `labels.description`, drawn after
     * it on the same line, each a [](/docs/config/featurenamelabel) and
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
         * The text after each ID.
         */
        description: featureDescriptionLabelConfigSchema,
      },
      { closed: true, plot: true },
    ),
  },
  { closed: true, plot: true },
)
