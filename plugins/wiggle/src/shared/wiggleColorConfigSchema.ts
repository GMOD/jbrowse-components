import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorDomainSlot,
  colorLabelsSlot,
  colorRampSlots,
  colorRangeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import type { FieldPresets } from '@jbrowse/core/util/colorScale'

/** The one thing a quantitative display's color maps; a subtrack's color is `rowColor`'s. */
const WIGGLE_COLOR_FIELDS = ['score'] as const

/** A ramp here runs across the y domain through the y scale's own type, so no color scale is `log`. */
const WIGGLE_COLOR_SCALES = ['none', 'linear', 'threshold'] as const

/** The field a color naming neither a field nor a constant maps: the bicolor pair is `score` cut at the origin. */
export const WIGGLE_IMPLIED_FIELD = 'score'

/**
 * `score` is the pair about the origin while `scale` is unset, which bars,
 * points and lines draw as this threshold; a heatmap draws it as a fade
 * (`paintedWiggleColor`).
 */
export const WIGGLE_FIELD_PRESETS = {
  '*': { scale: 'threshold' },
} as const satisfies FieldPresets

/**
 * #config WiggleColor
 * #category display
 * The quantitative display's `color`: one CSS color for every mark, or `score`
 * through a scale. Through `threshold` it paints a solid color each side of
 * one cut, the `origin` where the domain names none, and a color per band
 * where it names more, on every mark; through `linear` a gradient across the
 * y domain, through the y scale's own type, which colors each bar, point and
 * density cell by its score. A line still parts in the gradient's two end
 * colors. With no `scale`, a two-color `range` (red and blue unset) is the
 * pair about the `origin`, which each mark draws in its own idiom: bars,
 * points and lines solid either side of it, as a threshold, and a heatmap
 * (`mark: 'span'`) fading to each from white at it, as a ramp whose middle
 * stop `domainMid` moves. A subtrack's own color is `rowColor`'s. A wiggle colors per
 * signal rather than per feature, so a `jexl:` callback over a feature has
 * nothing to read here.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', color: 'darkgreen' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   color: { field: 'score', scale: 'threshold', domain: [2], range: ['#2166ac', '#b2182b'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   mark: 'span',
 *   color: { field: 'score', scale: 'linear', scheme: 'viridis' },
 * }
 * ```
 * A copy-number heatmap, white at two copies, blue losses and red gains:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   mark: 'span',
 *   origin: 2,
 *   color: { field: 'score', range: ['#2166ac', '#b2182b'] },
 * }
 * ```
 */
export const wiggleColorSchema = ConfigurationSchema(
  'WiggleColor',
  {
    /**
     * #slot value
     * One CSS color for every mark, a density cell included, so a heatmap
     * under one is a flat strip. Writing `color: "darkgreen"` lands here.
     * Unset, the display paints the pair about the `origin`, and several
     * sources sharing one plot box each paint their row color.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color painting every bar',
    },
    /**
     * #slot field
     * `score`, which stands for the plotted value whatever field `y` names,
     * since a quantitative display colors only the value it plots. Unset, the
     * color paints `value`, or `score` while `value` is unset too, which
     * `jbrowse validate` reads alike. Any other name is refused, which also
     * keeps a feature track's `displayDefaults.color` over a field of its
     * features off this display.
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorField', [...WIGGLE_COLOR_FIELDS]),
      description:
        "score, standing for the plotted value whatever field y names; the only field a quantitative display's color maps",
    },
    /**
     * #slot scale
     * The scale from `score` to a color. `threshold` paints each band between two
     * of its cuts, solid, on every mark;
     * `linear` runs `range`, else `scheme`, else viridis across
     * the y domain through `scales.y.type`, with `domainMid` at the middle
     * stop, coloring each bar, point and density cell by its score; a one-color
     * `range` paints flat, so one color is `value`. A line still parts
     * in the two end colors. `none` paints `value`, keeping the field for a
     * switch back. Unset, `range` is the pair about the `origin`: a
     * threshold on bars, points and lines, and on a heatmap a ramp through
     * white at the origin.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorScale', [...WIGGLE_COLOR_SCALES]),
      description:
        'threshold bands score at the domain cuts, solid on every mark, linear ramps it across the y domain, none paints value; unset, range is the pair about the origin, solid on bars, points and lines and fading from white there on a heatmap',
    },
    ...colorDomainSlot({
      domain:
        'for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin',
    }),
    ...colorRangeSlot({
      range:
        "a threshold scale's color for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one color painting flat",
    }),
    ...colorRampSlots,
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color', WIGGLE_FIELD_PRESETS, {
    impliedField: WIGGLE_IMPLIED_FIELD,
  }),
)
