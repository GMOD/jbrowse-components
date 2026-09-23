import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'

/**
 * #config VariantRowColor
 * #category display
 * The multi-sample variant displays' `rowColor`: `RowColor`'s pairs plus
 * `field`, a sample-metadata attribute (a column of the adapter's
 * samplesTsvLocation, e.g. `population`) whose values each take a palette
 * colour. While `field` names an attribute the samples carry, its palette
 * tints every row, ahead of the pairs and of a samplesTsv `color` column; with
 * none, a row's pair wins, then its samplesTsv colour. A string is the field.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', rowColor: 'population' }
 * ```
 */
export const variantRowColorSchema = ConfigurationSchema(
  'VariantRowColor',
  {
    /**
     * #slot field
     * The sample-metadata attribute whose values each take a palette colour.
     * Writing `rowColor: "population"` lands here; empty tints no row by
     * attribute.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        "the sample-metadata attribute (a column of the adapter's samplesTsvLocation, e.g. population) whose values each take a palette colour; while set it wins over a row's own colour",
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowColorConfigSchema,
    shorthand: 'field',
  },
)
