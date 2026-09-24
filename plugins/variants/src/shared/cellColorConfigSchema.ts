import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DISCRETE_COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config VariantCellColor
 * #category display
 * The multi-sample variant displays' `color` setting: the hue of every
 * alt-carrying genotype cell, which `shadeByDosage` then lightens for a
 * heterozygote. Unset, the cells paint the genotype colours. A CSS colour or
 * `jexl:` callback in `value` paints every alt cell of a variant; a `field`
 * gives each of its values a colour with a key. Three fields are presets:
 * `impact`, the most severe SnpEff/VEP consequence tier; `svType`, the
 * structural-variant class; `phaseSet`, the FORMAT PS block, in phased mode.
 * Any other field is read off the record — `INFO.CLNSIG`, `QUAL`, or a
 * `jexl:` expression — and a numeric one cut into intervals by a `threshold`
 * scale. A string is the constant.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', color: { field: 'impact' } }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
 *   color: {
 *     field: 'INFO.AF',
 *     scale: 'threshold',
 *     domain: ['0.001', '0.01', '0.05'],
 *     range: ['#b2182b', '#ef8a62', '#67a9cf', '#2166ac'],
 *   },
 * }
 * ```
 */
export const cellColorConfigSchema = ConfigurationSchema(
  'VariantCellColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one, for every
     * alt cell of the variant. Unset, the cells paint the genotype colours.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS colour or jexl callback for every alt cell',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: DISCRETE_COLOR_SCALES,
      scaleName: 'VariantCellColorScale',
      fieldType: 'featureField',
      field:
        'impact, the most severe SnpEff/VEP consequence tier; svType, the structural-variant class; phaseSet, the FORMAT PS block in phased mode; or any record field, INFO.CLNSIG say, or a jexl expression over feature, whose values each paint one range colour with a key. A record with no value keeps the default alt colour',
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
  },
  colorChannelOptions('color'),
)
