import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DISCRETE_COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorLabelsSlot,
  colorRangeSlot,
  colorTitleSlot,
  colorUnknownSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MultiWayGeneColor
 * #category display
 * The multi-way synteny display's gene `color`: a CSS color or `jexl:`
 * callback in `value`, or a field whose values each take a range color, or
 * whose numbers each take the color of the interval between cut points they
 * fall in, with a key. A string is the constant; the object binds the field.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', color: { field: 'cluster' } }
 * ```
 */
export const geneColorConfigSchema = ConfigurationSchema(
  'MultiWayGeneColor',
  {
    /**
     * #slot value
     * A CSS color, or a jexl callback over `feature` returning one; unset,
     * goldenrod.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color or jexl callback',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: DISCRETE_COLOR_SCALES,
      scaleName: 'MultiWayGeneColorScale',
      fieldType: 'featureField',
      field:
        'a feature field, or a jexl expression over feature, whose values each take one range color, with a key; cluster paints a gene, or a placement box, by its ortholog group',
      scale:
        'categorical a range color per value of field; threshold a range color per interval between the cut points in domain; unset follows field',
    }),
    ...colorDomainSlot({
      domain:
        'the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it',
    }),
    ...colorRangeSlot({
      range:
        'CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts',
    }),
    ...colorUnknownSlot,
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color'),
)
