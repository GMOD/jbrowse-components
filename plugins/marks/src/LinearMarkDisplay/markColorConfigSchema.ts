import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import {
  COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorLabelsSlot,
  colorRampSlots,
  colorRangeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MarkColor
 * #category display
 * A mark's `encoding.color`: one CSS colour or `jexl:` callback for every
 * instance, or a field through a categorical scale (a `range` colour per
 * value), a `linear` or `log` scale (a ramp between `domainMin` and
 * `domainMax`, `domainMid` placing its middle stop where a diverging ramp
 * turns) or a `threshold` scale (a `range` colour per interval between the
 * cut points `domain` lists). A string is the constant; the object binds the
 * field, and a scale is what the legend describes.
 *
 * #example
 * ```js
 * { mark: 'bar', encoding: { y: 'score', color: 'steelblue' } }
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
     * A CSS colour, or a jexl callback over `feature` returning one, for a
     * mark whose colour is not a scale. Writing `color: 'red'` or
     * `color: 'jexl:…'` directly on the encoding lands here.
     */
    value: {
      type: 'color',
      defaultValue: DEFAULT_MARK_COLOR,
      description: 'CSS colour or jexl callback',
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
        'how field becomes a colour: categorical hands out range colours per distinct value; linear and log read the value between domainMin and domainMax into a ramp; threshold cuts the value at the domain and hands each interval a range colour; none paints value, keeping a field for a switch back; unset beside a field, it is categorical',
    }),
    ...colorDomainSlot({
      domain:
        "for a categorical scale, the values in legend order, walking the range from the first entry and continuing into the default palette past its end (a value left out derives its colour from itself and never takes a listed value's, so every region agrees); for a threshold scale, the cut points in ascending order, a value taking the range entry for the number of them it is at or past, so range has one entry more than this; a linear or log scale reads domainMin and domainMax instead",
    }),
    ...colorDomainEndsSlots,
    ...colorRangeSlot({
      range:
        "CSS colours a categorical scale hands its domain in order, a threshold scale its intervals, or a linear or log scale's ramp as evenly spaced stops; empty is the default palette, or the scheme",
    }),
    ...colorLabelsSlot,
    ...colorRampSlots,
    ...colorTitleSlot,
  },
  colorChannelOptions('color'),
)
