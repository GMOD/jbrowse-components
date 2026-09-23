import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorDomainSlot,
  colorRangeSlot,
  normalizeChannel,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config VariantRowColor
 * #category display
 * The multi-sample variant displays' `rowColor`: the tint beside each row's
 * label. `field` names a sample-metadata attribute (a column of the adapter's
 * samplesTsvLocation, e.g. `population`) whose values each take a palette
 * colour; `domain`/`range` pair row names with the colour a reader set in the
 * arrangement dialog. While `field` names an attribute the samples carry, its
 * palette tints every row, ahead of those pairs and of a samplesTsv `color`
 * column; with none, a row's pair wins, then its samplesTsv colour. A string
 * is the field.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', rowColor: 'population' }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
 *   rowColor: { domain: ['NA12878', 'NA12891'], range: ['#b2182b', '#2166ac'] },
 * }
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
    ...colorDomainSlot({
      domain: 'the rows given a colour of their own, by name',
    }),
    ...colorRangeSlot({
      range: 'the CSS colour each row in domain takes, in the same order',
    }),
  },
  {
    shorthand: 'field',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'rowColor'),
  },
)
