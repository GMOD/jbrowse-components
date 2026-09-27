import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DISCRETE_COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorLabelsSlot,
  colorRangeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config ChordColor
 * #category display
 * A variant chord's `color`: a CSS colour or `jexl:` callback in `value` for
 * every chord, or a `field` of the record whose values each take a range
 * colour, with a key on the circle. `svType` paints the structural-variant
 * classes the variant displays paint. A string is the constant.
 *
 * #example
 * ```js
 * { type: 'ChordVariantDisplay', color: { field: 'svType' }, opacity: 0.45 }
 * ```
 */
export const chordColorConfigSchema = ConfigurationSchema(
  'ChordColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one, for every
     * chord.
     */
    value: {
      type: 'color',
      defaultValue: 'rgba(255,133,0,0.32)',
      description: 'CSS colour or jexl callback for every chord',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: DISCRETE_COLOR_SCALES,
      scaleName: 'ChordColorScale',
      fieldType: 'featureField',
      field:
        'a record field, svType say, or a jexl expression over feature, whose values each paint one range colour with a key',
      scale:
        'none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; unset follows field',
    }),
    ...colorDomainSlot({
      domain:
        'the values that take the range first, in order; under threshold, the ascending cut points, a value on a cut taking the interval above it',
    }),
    ...colorRangeSlot({
      range:
        'CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts',
    }),
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color'),
)
