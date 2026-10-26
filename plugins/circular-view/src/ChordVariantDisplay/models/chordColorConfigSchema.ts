import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DISCRETE_COLOR_SCALES,
  colorDiscreteSchemeSlots,
  colorChannelOptions,
  colorDomainSlot,
  colorFieldSlot,
  colorLegendOptions,
  colorNamesSlot,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorTitleSlot,
  colorInvalidSlot,
  colorUnknownSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

export const CHORD_DEFAULT_COLOR = 'rgb(255,133,0)'

/**
 * #config ChordColor
 * #category display
 * A variant chord's `encoding.color`: a CSS color or `jexl:` callback in
 * `value` for every chord, or a `field` of the record whose values each take
 * a range color, with a key on the circle. `svType` paints the
 * structural-variant classes the variant displays paint. A string is the
 * field.
 *
 * #example
 * ```js
 * { type: 'ChordVariantDisplay', encoding: { color: 'svType', opacity: 0.45 } }
 * ```
 */
export const chordColorConfigSchema = ConfigurationSchema(
  'ChordColor',
  {
    /**
     * #slot value
     * A CSS color, or a jexl callback over `feature` returning one, for every
     * chord.
     */
    value: {
      type: 'color',
      defaultValue: CHORD_DEFAULT_COLOR,
      description: 'CSS color or jexl callback for every chord',
      contextVariable: ['feature'],
    },
    ...colorFieldSlot({
      fieldType: 'featureField',
      field:
        'a record field, svType say, or a jexl expression over feature, whose values each paint one range color with a key',
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'ChordColorScale',
      {
        ...colorScaleTypeSlot({
          scales: DISCRETE_COLOR_SCALES,
          scaleName: 'ChordColorScaleType',
          type: 'ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; unset follows field',
        }),
        ...colorDomainSlot({
          domain:
            'the values that take the range first, in order; under threshold, the ascending cut points, a value on a cut taking the interval above it',
        }),
        ...colorRangeSlot({
          range:
            'CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts',
        }),
        ...colorDiscreteSchemeSlots,
        ...colorUnknownSlot,
        ...colorInvalidSlot,
        ...colorNamesSlot,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'ChordColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color'),
)
