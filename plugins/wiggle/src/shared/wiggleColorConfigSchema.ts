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

/** `score` is the bicolor cut while `scale` is unset. */
export const WIGGLE_FIELD_PRESETS = {
  '*': { scale: 'threshold' },
} as const satisfies FieldPresets

/**
 * #config WiggleColor
 * #category display
 * The quantitative display's `color`: one CSS color for every bar, or `score`
 * through a scale. Through a `threshold` scale it is the bicolor plot — a
 * color each side of one cut, the `origin` where the domain names none, and a
 * color per band where it names more — and through `linear` a gradient across
 * the y domain, through the y scale's own type, which colors each bar, point
 * and density cell by its score. A line still parts in the gradient's two end
 * colors. A subtrack's own color is `rowColor`'s. A wiggle colors per
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
 */
export const wiggleColorSchema = ConfigurationSchema(
  'WiggleColor',
  {
    /**
     * #slot value
     * One CSS color for every bar. Writing `color: "darkgreen"` lands here.
     * Unset, the display paints the pos/neg pair about the `origin`, and
     * several sources sharing one plot box each paint their row color.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color painting every bar',
    },
    /**
     * #slot field
     * `score`, the value each bar carries. Unset, the color paints
     * `value`.
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorField', [...WIGGLE_COLOR_FIELDS]),
      description: 'score, the value each bar carries',
    },
    /**
     * #slot scale
     * How `score` becomes a color. `threshold` paints each band between two
     * of its cuts, and on a density plot (`mark: 'span'`) fades from white at
     * the lowest cut to the first `range` color below it and the last above it;
     * `linear` runs `range`, else `scheme`, else viridis across
     * the y domain through `scales.y.type`, with `domainMid` at the middle
     * stop, coloring each bar, point and density cell by its score, and a
     * one-color `range` runs from white to that color; a line still parts
     * in the two end colors. `none` paints `value`, keeping the field for a
     * switch back. Unset beside the field, it is `threshold`.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorScale', [...WIGGLE_COLOR_SCALES]),
      description:
        'threshold bands score at the domain cuts, and on a density plot fades from white at the lowest cut to the first range color below it and the last above it, linear ramps it across the y domain, none paints value; unset beside a field is threshold',
    },
    ...colorDomainSlot({
      domain:
        'for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin',
    }),
    ...colorRangeSlot({
      range:
        "a threshold scale's color for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one color meaning white to it",
    }),
    ...colorRampSlots,
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color', WIGGLE_FIELD_PRESETS),
)
