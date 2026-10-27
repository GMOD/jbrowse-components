import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorDomainSlot,
  colorLegendOptions,
  colorNamesSlot,
  colorRampSlots,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { FieldPresets } from '@jbrowse/core/util/colorScale'

/** A ramp here runs across the y domain through the y scale's own type, so no color scale is `log`. */
const WIGGLE_COLOR_SCALES = ['linear', 'threshold'] as const

/**
 * The field a color writing a scale but no field maps: the bicolor pair is
 * `score` cut at the origin. One writing nothing at all colors by `source`
 * on bars, points and lines (`wiggleColorsBySource`).
 */
export const WIGGLE_IMPLIED_FIELD = 'score'

/** The two fields a wiggle color reads: the plotted value, or the subtrack. */
export const WIGGLE_COLOR_FIELDS = ['', 'score', 'source'] as const

/**
 * `score` is the pair about the origin while `scale.type` is unset, which
 * bars, points and lines draw as this threshold; a heatmap draws it as a fade
 * (`paintedWiggleColor`). `source` is categorical, its colors the rows'.
 */
export const WIGGLE_FIELD_PRESETS = {
  source: { scale: { type: 'ordinal' } },
  '*': { scale: { type: 'threshold' } },
} as const satisfies FieldPresets

/**
 * #config WiggleColor
 * #category display
 * The quantitative display's `encoding.color`: one CSS color for every mark,
 * the plotted score through a scale, or each subtrack in its row color.
 * `field` is `score`, which stands for the plotted value whatever field `y`
 * names, or `source`, the subtrack.
 *
 * - `threshold` paints a solid color each side of one cut, the `origin`
 *   where `scale.domain` names none, and a color per band where it names
 *   more, on every mark
 * - `linear` paints a gradient across the y domain, through the y scale's
 *   own type: each bar, point and density cell by its score, and a line by
 *   the score along it
 * - unset `scale.type`, a two-color `scale.range` (red and blue unset) is the
 *   pair about the `origin`: bars, points and lines solid either side of it,
 *   and a heatmap (`mark: 'rect'`) fading to each from white at it, a ramp
 *   whose middle stop `scale.domainMid` moves
 *
 * `source` paints each subtrack its row color, `rowColor`'s entry, else the
 * file's `color`, else a palette color where several share one plot, on both
 * sides of the `origin`; a subtrack with none paints the score's pair. A
 * color writing nothing does the same on bars, points and lines, so a lone
 * BigWig keeps its pair, and a heatmap ramps the score. A wiggle colors per
 * signal rather than per feature, so a `jexl:` callback over a feature has
 * nothing to read here.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', encoding: { color: { value: 'darkgreen' } } }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   encoding: {
 *     color: {
 *       scale: { type: 'threshold', domain: [2], range: ['#2166ac', '#b2182b'] },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   mark: 'rect',
 *   encoding: { color: { scale: { type: 'linear', scheme: 'viridis' } } },
 * }
 * ```
 * Subtracks in their row colors, as they paint while `encoding.color` is
 * unset:
 * ```js
 * { type: 'LinearWiggleDisplay', encoding: { color: 'source' } }
 * ```
 * A copy-number heatmap, white at two copies, blue losses and red gains:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   mark: 'rect',
 *   origin: 2,
 *   encoding: { color: { scale: { range: ['#2166ac', '#b2182b'] } } },
 * }
 * ```
 */
export const wiggleColorSchema = ConfigurationSchema(
  'WiggleColor',
  {
    /**
     * #slot field
     * `score` for the plotted value, through `scale`; `source` for each
     * subtrack's row color, which reads no `scale`. Unset, a color writing a
     * `scale` maps `score`, and one writing nothing maps `source` on bars,
     * points and lines and `score` on a heatmap.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('WiggleColorField', [...WIGGLE_COLOR_FIELDS]),
      defaultValue: '',
      description:
        'score for the plotted value through scale, source for each subtrack in its row color; unset, a written scale maps score and an empty color source',
    },
    /**
     * #slot value
     * One CSS color for every mark, a density cell included, so a heatmap
     * under one is a flat strip. Unset, the display paints the pair about the
     * `origin`, and several sources sharing one plot box each paint their row
     * color.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color painting every bar',
    },
    /**
     * #slot scale
     * The scale from the score to a color. `threshold` paints each band
     * between two of its cuts, solid, on every mark; `linear` runs `range`,
     * else `scheme`, else viridis across the y domain through
     * `encoding.y.scale.type`, with `domainMid` at the middle stop, coloring each bar,
     * point and density cell by its score; a one-color `range` paints flat,
     * so one color is `value`. With `type` unset, `range` is the pair about
     * the `origin`: a threshold on bars, points and lines, and on a heatmap a
     * ramp through white at the origin.
     */
    scale: ConfigurationSchema(
      'WiggleColorScale',
      {
        ...colorScaleTypeSlot({
          scales: WIGGLE_COLOR_SCALES,
          scaleName: 'WiggleColorScaleType',
          type: 'threshold bands score at the domain cuts, solid on every mark, linear ramps it across the y domain; unset, range is the pair about the origin, solid on bars, points and lines and fading from white there on a heatmap',
        }),
        ...colorDomainSlot({
          domain:
            'for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin',
        }),
        ...colorRangeSlot({
          range:
            "a threshold scale's color for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one color painting flat",
        }),
        ...colorRampSlots,
        ...colorNamesSlot,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'WiggleColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', WIGGLE_FIELD_PRESETS, {
    impliedField: WIGGLE_IMPLIED_FIELD,
  }),
)
