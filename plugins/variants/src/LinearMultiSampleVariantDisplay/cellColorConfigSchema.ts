import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DISCRETE_COLOR_SCALES,
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

/**
 * #config VariantCellColor
 * #category display
 * The multi-sample variant display's `encoding.color`: the hue of every
 * genotype cell with an alt allele, which `shadeByDosage` then lightens for a
 * heterozygote. Unset, the cells paint the genotype colors. A CSS color or
 * `jexl:` callback in `value` paints every alt cell of a variant; a `field`
 * gives each of its values a color with a key. Three fields are presets:
 * `impact`, the most severe SnpEff/VEP consequence tier; `svType`, the
 * structural-variant class; `phaseSet`, the FORMAT PS block, in phased mode.
 * Any other field is read off the record — `INFO.CLNSIG`, `QUAL`, or a
 * `jexl:` expression — and a numeric one cut into intervals by a `threshold`
 * scale. A string is the field.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', encoding: { color: 'impact' } }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
 *   encoding: {
 *     color: {
 *       field: 'INFO.AF',
 *       scale: {
 *         type: 'threshold',
 *         domain: [0.001, 0.01, 0.05],
 *         range: ['#b2182b', '#ef8a62', '#67a9cf', '#2166ac'],
 *       },
 *     },
 *   },
 * }
 * ```
 */
export const cellColorConfigSchema = ConfigurationSchema(
  'VariantCellColor',
  {
    /**
     * #slot value
     * A CSS color, or a jexl callback over `feature` returning one, for every
     * alt cell of the variant. Unset, the cells paint the genotype colors.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color or jexl callback for every alt cell',
      contextVariable: ['feature'],
    },
    ...colorFieldSlot({
      fieldType: 'featureField',
      field:
        'impact, the most severe SnpEff/VEP consequence tier; svType, the structural-variant class; phaseSet, the FORMAT PS block in phased mode; or any record field, INFO.CLNSIG say, or a jexl expression over feature, whose values each paint one range color with a key. A record with no value keeps the default alt color',
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'VariantCellColorScale',
      {
        ...colorScaleTypeSlot({
          scales: DISCRETE_COLOR_SCALES,
          scaleName: 'VariantCellColorScaleType',
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
      'VariantCellColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color'),
)
