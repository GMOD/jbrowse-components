import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  FEATURE_FIELD_PRESETS,
  colorChannelOptions,
  colorDescendingSlot,
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

import { MARK_COLOR_SCALES } from './markVocabulary.ts'

/** A mark channel's `legend` options: `values` written as numbers read as strings. */
export const markLegendOptions = {
  ...colorLegendOptions,
  preProcessSnapshot: (snap: Record<string, unknown> = {}) =>
    Array.isArray(snap.values)
      ? { ...snap, values: snap.values.map(String) }
      : snap,
}

/**
 * #config MarkColor
 * #category display
 * A mark's `encoding.color`: one CSS color or `jexl:` callback for every
 * instance in `value`, or a `field` through `scale`, Vega-Lite's scale
 * object: an ordinal scale (a `range` color per value), a `linear`, `log` or
 * `symlog` scale (a ramp between `domainMin` and `domainMax`, `domainMid`
 * placing its middle stop where a diverging ramp turns; `symlog` runs
 * logarithmic away from 0 and linear through it, so a signed fold change
 * ramps on both sides) or a `threshold` scale (a `range` color per interval
 * between the cut points `domain` lists). An `identity` scale paints each
 * feature the CSS color its `field` holds, or with no field the BED color it
 * carries. A string is the field, as
 * every channel's is inside `encoding`; a constant is `{ value }`. `legend`
 * shapes the key the scale draws.
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
 *   encoding: {
 *     y: 'score',
 *     color: { field: 'strand', scale: { domain: ['1', '-1'] } },
 *   },
 * }
 * ```
 * ```js
 * {
 *   mark: 'rect',
 *   encoding: {
 *     color: {
 *       field: 'score',
 *       scale: {
 *         type: 'log',
 *         domainMin: 1,
 *         domainMax: 1000,
 *         range: ['white', 'red'],
 *       },
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
 *       scale: {
 *         type: 'linear',
 *         domainMin: -2,
 *         domainMax: 6,
 *         domainMid: 0,
 *         range: ['blue', 'white', 'red'],
 *       },
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
 *       scale: {
 *         type: 'threshold',
 *         domain: [0.1, 0.5],
 *         range: ['#357ebd', '#eea236', '#d43f3a'],
 *       },
 *       legend: { title: 'PIP', descending: true },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   mark: 'rect',
 *   encoding: {
 *     row: 'cellType',
 *     color: {
 *       scale: {
 *         type: 'identity',
 *         domain: ['rgb(255,0,0)', 'rgb(0,128,0)'],
 *         names: ['Active TSS', 'Strong transcription'],
 *       },
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
    ...colorFieldSlot({
      fieldType: 'featureField',
      field:
        'the feature field a scale reads, or a jexl expression over feature, which is slower per feature and so the opt-in',
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'MarkColorScale',
      {
        ...colorScaleTypeSlot({
          scales: MARK_COLOR_SCALES,
          scaleName: 'MarkColorScaleType',
          type: 'ordinal hands out range colors per distinct value; linear, log and symlog read the value between domainMin and domainMax into a ramp; threshold cuts the value at the domain and hands each interval a range color; identity paints each feature the CSS color its field holds, or with no field its own BED color, black included, the key naming the colors in domain; unset is linear for score and ordinal for any other field',
        }),
        ...colorDomainSlot({
          domain:
            'for an ordinal scale, the values in legend order, walking the range from the first entry and continuing into the default palette past its end (a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it); for a threshold scale, the cut points in ascending order, a value taking the range entry for the number of them it is at or past, so range has one entry more than this; a linear or log scale reads domainMin and domainMax instead',
        }),
        ...colorDomainEndsSlots,
        ...colorDomainQuantileSlot,
        ...colorRangeSlot({
          range:
            "CSS colors an ordinal scale hands its domain in order, a threshold scale its intervals, or a ramp's evenly spaced stops; empty is the default palette for ordinal, the scheme, or for a threshold the default ramp sampled per interval",
        }),
        ...colorUnknownSlot,
        ...colorInvalidSlot,
        ...colorNamesSlot,
        ...colorRampSlots,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel's scale draws.
     */
    legend: ConfigurationSchema(
      'MarkColorLegend',
      {
        ...colorTitleSlot,
        ...colorDescendingSlot,
        /**
         * #slot legend.values
         * The values an ordinal key lists, in this order; empty lists every
         * value the loaded regions met. A value left out still paints, as
         * Vega-Lite's `legend.values` and ggplot2's `breaks` leave it.
         */
        values: {
          type: 'stringArray',
          defaultValue: [],
          description: 'values the key lists; empty lists every value met',
        },
        /**
         * #slot legend.missingLabel
         * The key's name for a feature with nothing in `field`; unset is
         * "(no value)". Vega-Lite's legend has no such member, so it keeps
         * its JBrowse name.
         */
        missingLabel: {
          type: 'maybeString',
          description: 'key row for a feature with no value',
        },
      },
      markLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', FEATURE_FIELD_PRESETS),
)
