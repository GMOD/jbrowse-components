import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  featureDescriptionLabelConfigSchema,
  featureGateConfigSchemaFields,
  featureNameLabelConfigSchema,
} from '@jbrowse/plugin-features'

import { DEFAULT_RECORDS_MAX_HEIGHT } from './variantTopBands.ts'

/**
 * #config RecordsBand
 * #category display
 * The multi-sample variant display's `records` band: the VCF's structural
 * variants above the genotype rows, stacked as a `LinearVariantDisplay`
 * stacks them, so a nested SV sits under the one holding it. SNVs and small
 * indels are left out, so a region without SVs spends no height on it. A
 * record is colored by its SV type, keyed, or by `encoding.color` when that
 * is set, and lettered on one line with its ID, description and the share of
 * the samples shown as rows, no-calls included, that carry it. The band grows
 * to its stack, up to `maxHeight`; past that names thin and go, then boxes
 * shrink. Past 0.2 records per pixel names go, past 0.1 descriptions, as on a
 * feature track. Hovering a record reports it and its carriers, and clicking
 * opens its details. At genomic positions only.
 *
 * With no genotype rows (a VCF with no samples, or `genotypes.show` off) the
 * band is the whole display whatever `show` says: every record, in the
 * feature track's default color, lettered as a `LinearVariantDisplay` letters
 * it (the description under the name, no carrier share) and sized by the
 * display's `heightMode`. Past `maxFeatureScreenDensity` records per pixel it
 * refuses the window with the region-too-large banner and its Force load, as
 * `LinearVariantDisplay` does; over genotype rows that budget is not read.
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
    maxHeight: {
      type: 'number',
      defaultValue: DEFAULT_RECORDS_MAX_HEIGHT,
      description:
        'ceiling in pixels on the band, which grows to its stack of records and takes that height from the rows',
    },
    ...featureGateConfigSchemaFields,
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
