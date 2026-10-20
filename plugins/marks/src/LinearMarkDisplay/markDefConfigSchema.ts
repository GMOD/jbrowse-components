import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  DEFAULT_LINE_INTERPOLATE,
  DEFAULT_MARK_TYPE,
  LINE_INTERPOLATIONS,
  MARK_TYPES,
} from './markVocabulary.ts'

/**
 * #config MarkDef
 * #category display
 * A `marks` entry's `mark`, Vega-Lite's mark object: the `type` it draws as,
 * and a line's `interpolate`. A bare name is the `type`, so `mark: "line"`
 * and `mark: { type: "line" }` are one mark.
 *
 * #example
 * ```js
 * {
 *   mark: { type: 'line', interpolate: 'linear' },
 *   encoding: { y: 'score' },
 * }
 * ```
 */
export const markDefSchema = ConfigurationSchema(
  'MarkDef',
  {
    /**
     * #slot
     * `bar` spans from `origin` to `y`; `point` is a shape at `y` over
     * the middle of `x` to `x2`; `rule` is a line across `x` to `x2` at `y`,
     * `encoding.size` px thick; `line` is a stroke through consecutive
     * values, held across each span or run centre to centre as `interpolate`
     * says, dropping to `origin` across a gap; `span` is a band across the
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
      description: 'bar, point, rule, line, span, text or link',
    },
    /**
     * #slot
     * The path a `line` takes between values: `step` holds each across its
     * span, as the data says; `linear` runs from one span's centre to the next,
     * smoother where the spans are few. Read by a line alone.
     */
    interpolate: {
      type: 'stringEnum',
      model: types.enumeration('LineInterpolation', [...LINE_INTERPOLATIONS]),
      defaultValue: DEFAULT_LINE_INTERPOLATE,
      description: 'step or linear, for a line',
    },
  },
  { shorthand: 'type', writes: 'members', closed: true },
)
