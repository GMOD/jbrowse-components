import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  DEFAULT_HEIGHT_BAND,
  DEFAULT_MARK_TYPE,
  MARK_INTERPOLATIONS,
  MARK_TYPES,
} from './markVocabulary.ts'

const markHeightSchema = ConfigurationSchema(
  'MarkHeight',
  {
    /**
     * #slot height.band
     * The fraction of its band a rect fills, centred in the band, so below 1
     * the rows stand apart. Read by a rect alone; the track menu's Row height
     * presets write every rect's.
     */
    band: {
      type: 'number',
      defaultValue: DEFAULT_HEIGHT_BAND,
      description: 'fraction of its band a rect fills',
    },
  },
  { closed: true },
)

/**
 * #config MarkDef
 * #category display
 * A `marks` entry's `mark`, Vega-Lite's mark object: the `type` it draws as,
 * and the members one type alone reads, a line's or a link's `interpolate`,
 * a rect's `height` and a line's `gapBp`. A bare name is the `type`, so
 * `mark: "line"` and `mark: { type: "line" }` are one mark.
 *
 * #example
 * ```js
 * {
 *   mark: { type: 'line', interpolate: 'linear' },
 *   encoding: { y: 'score' },
 * }
 * ```
 * ```js
 * { mark: { type: 'rect', height: { band: 0.8 } } }
 * ```
 */
export const markDefSchema = ConfigurationSchema(
  'MarkDef',
  {
    /**
     * #slot
     * `bar` spans from `origin` to `y`; `point` is a shape at `y` over
     * the middle of `x` to `x2`; `rule` is a line across `x` to `x2` at `y`,
     * `encoding.strokeWidth` px thick; `line` is a stroke through consecutive
     * values, held across each span or run centre to centre as `interpolate`
     * says, dropping to `origin` across a gap; `rect` is a band across the
     * whole plot from `x` to `x2`; `text` prints a field over the middle of
     * `x` to `x2`, just above `y` where it names one, at the apex of a link
     * drawn between the same two ends, and in the middle of its band
     * otherwise, and the display omits a label that would overlap one already
     * placed to its left; `link` is a curve from `x` up and over to `x2`,
     * which may lie on another sequence, its apex at `y` where it names one.
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('MarkType', [...MARK_TYPES]),
      defaultValue: DEFAULT_MARK_TYPE,
      description: 'bar, point, rule, line, rect, text or link',
    },
    /**
     * #slot
     * The path a `line` or a `link` takes between its ends. A line takes
     * `step`, holding each value across its span as the data says, or
     * `linear`, running from one span's centre to the next, smoother where
     * the spans are few; unset is `step`. A link takes `dome`, a half-ellipse
     * whose apex is the pair's half-width clamped to the band, `arc`, a true
     * semicircle that may leave it, or `linear`, a straight segment between
     * the feet, on the baseline or at the `y` value; unset is `dome`. A dome
     * or arc wider than three view widths becomes a circle whose legs rise
     * from each foot.
     */
    interpolate: {
      type: 'maybeStringEnum',
      model: types.enumeration('MarkInterpolation', [...MARK_INTERPOLATIONS]),
      description:
        'step or linear for a line, dome, arc or linear for a link; unset is step or dome',
    },
    /**
     * #slot
     * The height a `rect` draws at, as a fraction of its band:
     * `{ band: 0.8 }`, Vega-Lite's spelling.
     */
    height: markHeightSchema,
    /**
     * #slot
     * The stretch in bp a `linear` line breaks across rather than bridge:
     * where the next value's middle lies further on than this. Unset, a
     * `window` step in front sets it to the bases its frame spans at the
     * median row, so a moving average breaks where no data reached, and with
     * none the line runs unbroken. Read by a line alone.
     */
    gapBp: {
      type: 'maybeNumber',
      description: 'bp a line breaks across; unset follows a window step',
    },
  },
  { shorthand: 'type', writes: 'members', closed: true },
)
