import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  FEATURE_COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/** The field half of an arc colour object, which both arc displays' share. */
export const ARC_COLOR_FIELD_SLOTS = {
  ...colorChannelSlots({
    scales: FEATURE_COLOR_SCALES,
    scaleName: 'ArcColorScale',
    fieldType: 'featureField',
    field:
      'a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; strand paints forward tomato and reverse cornflowerblue unless domain or range says otherwise',
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
} as const

/**
 * #config ArcColor
 * #category display
 * The arc display's `color`: a CSS colour or `jexl:` callback over `feature`
 * in `value`, or a field whose values each take a range colour, or whose
 * numbers each take the colour of the interval between cut points they fall
 * in, with a key. A string is the constant; the object binds the field.
 *
 * #example
 * ```js
 * { type: 'LinearArcDisplay', color: "jexl:feature.strand==-1?'red':'blue'" }
 * ```
 * ```js
 * { type: 'LinearArcDisplay', color: { field: 'strand' } }
 * ```
 * ```js
 * {
 *   type: 'LinearArcDisplay',
 *   color: {
 *     field: 'score',
 *     scale: 'threshold',
 *     domain: ['10', '100'],
 *     range: ['#c6dbef', '#6baed6', '#08519c'],
 *   },
 * }
 * ```
 */
export const arcColorSchema = ConfigurationSchema(
  'ArcColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one. Writing
     * `color: "red"` or `color: "jexl:…"` lands here.
     */
    // #region contextVariableSlot
    value: {
      type: 'color',
      defaultValue: '#1976d2',
      description: 'CSS colour or jexl callback',
      contextVariable: ['feature'],
    },
    // #endregion
    ...ARC_COLOR_FIELD_SLOTS,
  },
  colorChannelOptions('color'),
)
