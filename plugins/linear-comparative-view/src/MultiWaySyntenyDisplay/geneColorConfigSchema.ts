import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  FEATURE_FIELD_PRESETS,
  FIELD_COLOR_SCALES,
  colorChannelOptions,
  colorDomainEndsSlots,
  colorDomainQuantileSlot,
  colorDomainSlot,
  colorFieldSlot,
  colorLegendOptions,
  colorNamesSlot,
  colorRampSlots,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorTitleSlot,
  colorInvalidSlot,
  colorUnknownSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MultiWayGeneColor
 * #category display
 * The multi-way synteny display's gene `encoding.color`: a CSS color or
 * `jexl:` callback in `value`, or a field whose values each take a range
 * color, whose numbers each take the color of the interval between cut
 * points they fall in, or whose numbers run along a color ramp, with a key. A
 * string is the field.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', encoding: { color: 'cluster' } }
 * ```
 * ```js
 * { type: 'MultiWaySyntenyDisplay', encoding: { color: { value: 'teal' } } }
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
    ...colorFieldSlot({
      fieldType: 'featureField',
      field:
        'a feature field, or a jexl expression over feature, whose values each take one range color, with a key; cluster paints a gene, or a placement box, by its ortholog group',
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'MultiWayGeneColorScale',
      {
        ...colorScaleTypeSlot({
          scales: FIELD_COLOR_SCALES,
          scaleName: 'MultiWayGeneColorScaleType',
          type: 'ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; linear or log a color along a ramp from domainMin to domainMax; unset is linear for score and ordinal for any other field',
        }),
        ...colorDomainSlot({
          domain:
            'the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it',
        }),
        ...colorRangeSlot({
          range:
            "CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts; under linear or log the ramp's stops, winning over scheme",
        }),
        ...colorUnknownSlot,
        ...colorInvalidSlot,
        ...colorNamesSlot,
        ...colorRampSlots,
        ...colorDomainEndsSlots,
        ...colorDomainQuantileSlot,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'MultiWayGeneColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', FEATURE_FIELD_PRESETS),
)
