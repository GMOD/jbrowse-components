import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  COLOR_SCALES,
  FEATURE_FIELD_PRESETS,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainQuantileSlot,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorDescendingSlot,
  colorLabelsSlot,
  colorRampSlots,
  colorRangeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MarkColor
 * #category display
 * A mark's `encoding.color`: one CSS color or `jexl:` callback for every
 * instance, or a field through a categorical scale (a `range` color per
 * value), a `linear` or `log` scale (a ramp between `domainMin` and
 * `domainMax`, `domainMid` placing its middle stop where a diverging ramp
 * turns) or a `threshold` scale (a `range` color per interval between the
 * cut points `domain` lists). A string is the field, as every channel's is
 * inside `encoding`; a constant is `{ value }`. A scale is what the legend
 * describes.
 *
 * #example
 * ```js
 * { mark: 'bar', encoding: { y: 'score', color: { value: 'steelblue' } } }
 * ```
 * ```js
 * { mark: 'point', encoding: { y: 'score', color: 'type' } }
 * ```
 * ```js
 * {
 *   mark: 'point',
 *   encoding: { y: 'score', color: { field: 'strand', domain: ['1', '-1'] } },
 * }
 * ```
 * ```js
 * {
 *   mark: 'span',
 *   encoding: {
 *     color: {
 *       field: 'score',
 *       scale: 'log',
 *       domainMin: 1,
 *       domainMax: 1000,
 *       range: ['white', 'red'],
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   mark: 'bar',
 *   encoding: {
 *     y: 'score',
 *     color: {
 *       field: 'score',
 *       scale: 'linear',
 *       domainMin: -2,
 *       domainMax: 6,
 *       domainMid: 0,
 *       range: ['blue', 'white', 'red'],
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   mark: 'point',
 *   encoding: {
 *     y: 'score',
 *     color: {
 *       field: 'pip',
 *       scale: 'threshold',
 *       domain: [0.1, 0.5],
 *       range: ['#357ebd', '#eea236', '#d43f3a'],
 *     },
 *   },
 * }
 * ```
 */
export const markColorSchema = ConfigurationSchema(
  'MarkColor',
  {
    // #region contextVariableSlot
    /**
     * #slot value
     * A CSS color, or a jexl callback over `feature` returning one, for a
     * mark whose color is not a scale. Unset, a mark paints in the default
     * blue, `#0068d1`, and a text mark prints in the page's text color.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color or jexl callback; unset is the default blue',
      contextVariable: ['feature'],
    },
    // #endregion
    ...colorChannelSlots({
      scales: COLOR_SCALES,
      scaleName: 'MarkColorScale',
      fieldType: 'featureField',
      field:
        'the feature field a scale reads, or a jexl expression over feature, which is slower per feature and so the opt-in',
      scale:
        'how field becomes a color: categorical hands out range colors per distinct value; linear and log read the value between domainMin and domainMax into a ramp; threshold cuts the value at the domain and hands each interval a range color; none paints value, keeping a field for a switch back; unset is linear for score and categorical for any other field',
    }),
    ...colorDomainSlot({
      domain:
        "for a categorical scale, the values in legend order, walking the range from the first entry and continuing into the default palette past its end (a value left out derives its color from itself and never takes a listed value's, so every region agrees); for a threshold scale, the cut points in ascending order, a value taking the range entry for the number of them it is at or past, so range has one entry more than this; a linear or log scale reads domainMin and domainMax instead",
    }),
    ...colorDomainEndsSlots,
    ...colorDomainQuantileSlot,
    ...colorRangeSlot({
      range:
        "CSS colors a categorical scale hands its domain in order, a threshold scale its intervals, or a linear or log scale's ramp as evenly spaced stops; empty is the default palette, or the scheme",
    }),
    ...colorLabelsSlot,
    ...colorRampSlots,
    ...colorTitleSlot,
    // `breaks` and `missingLabel` join another color object only where its
    // key would read them.
    /**
     * #slot breaks
     * The values a categorical key lists, in this order; empty lists every
     * value the loaded regions met. A value left out still paints, as
     * ggplot2's `breaks` leaves it.
     */
    breaks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'values the key lists; empty lists every value met',
    },
    ...colorDescendingSlot,
    /**
     * #slot missingLabel
     * What the key calls a feature with nothing in `field`; unset is
     * "(no value)".
     */
    missingLabel: {
      type: 'maybeString',
      description: 'key row for a feature with no value',
    },
  },
  {
    ...colorChannelOptions('color', FEATURE_FIELD_PRESETS),
    shorthand: 'field',
  },
)
