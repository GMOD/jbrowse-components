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

/** The one thing a quantitative display's colour maps; a subtrack's colour is `rowColor`'s. */
const WIGGLE_COLOR_FIELDS = ['score'] as const

/** A ramp here runs across the y domain through the y scale's own type, so no colour scale is `log`. */
const WIGGLE_COLOR_SCALES = ['none', 'linear', 'threshold'] as const

/** `score` is the bicolor cut while `scale` is unset. */
export const WIGGLE_FIELD_PRESETS = {
  '*': { scale: 'threshold' },
} as const satisfies FieldPresets

/**
 * #config WiggleColor
 * #category display
 * The quantitative display's `color`: one CSS colour for every bar, or `score`
 * through a scale. Through a `threshold` scale it is the bicolor plot — a
 * colour each side of one cut, the `origin` where the domain names none, and a
 * colour per band where it names more — and through `linear` a gradient across
 * the y domain, through the y scale's own type, which colours each bar, point
 * and density cell by its score. A line still parts in the gradient's two end
 * colours. A subtrack's own colour is `rowColor`'s. A wiggle colours per
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
 *   mark: 'heatmap',
 *   color: { field: 'score', scale: 'linear', scheme: 'viridis' },
 * }
 * ```
 */
export const wiggleColorSchema = ConfigurationSchema(
  'WiggleColor',
  {
    /**
     * #slot value
     * One CSS colour for every bar. Writing `color: "darkgreen"` lands here.
     * Unset, the display paints the pos/neg pair about the `origin`, and
     * several sources sharing one plot box each paint their row colour.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS colour painting every bar',
    },
    /**
     * #slot field
     * `score`, the value each bar carries. Unset, the colour paints
     * `value`.
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorField', [...WIGGLE_COLOR_FIELDS]),
      description: 'score, the value each bar carries',
    },
    /**
     * #slot scale
     * How `score` becomes a colour. `threshold` paints each band between two
     * of its cuts; `linear` runs `range`, else `scheme`, else viridis across
     * the y domain through `scales.y.type`, with `domainMid` at the middle
     * stop, colouring each bar, point and density cell by its score, and a
     * one-colour `range` runs from white to that colour; a line still parts
     * in the two end colours. `none` paints `value`, keeping the field for a
     * switch back. Unset beside the field, it is `threshold`.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('WiggleColorScale', [...WIGGLE_COLOR_SCALES]),
      description:
        'how score becomes a colour: threshold paints each band between two of its cuts; linear runs range, else scheme, else viridis across the y domain through scales.y.type, with domainMid at the middle stop, colouring each bar, point and density cell by its score, and a one-colour range runs from white to that colour; a line still parts in the two end colours; none paints value, keeping the field for a switch back; unset beside the field, it is threshold',
    },
    ...colorDomainSlot({
      domain:
        'for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin',
    }),
    ...colorRangeSlot({
      range:
        "a threshold scale's colour for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one colour meaning white to it",
    }),
    ...colorRampSlots,
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color', WIGGLE_FIELD_PRESETS),
)
