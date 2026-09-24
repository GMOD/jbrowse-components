import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DISCRETE_COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MultiWayGeneColor
 * #category display
 * The multi-way synteny display's gene `color`: a CSS colour or `jexl:`
 * callback in `value`, or a field whose values each take a range colour, or
 * whose numbers each take the colour of the interval between cut points they
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
     * A CSS colour, or a jexl callback over `feature` returning one. Unset,
     * goldenrod.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS colour or jexl callback',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: DISCRETE_COLOR_SCALES,
      scaleName: 'MultiWayGeneColorScale',
      fieldType: 'featureField',
      field:
        'a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; cluster paints a gene by the ortholog group it carries and a placement box by its own',
      scale:
        'none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; unset follows field',
    }),
    ...colorDomainSlot({
      domain:
        'the values that take the range first, in order; a value left out keeps a colour derived from itself that no listed value paints. Under threshold, the ascending cut points, a value on a cut taking the interval above it',
    }),
    ...colorRangeSlot({
      range:
        'CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts',
    }),
  },
  colorChannelOptions('color'),
)
