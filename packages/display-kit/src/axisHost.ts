import { SCORE_CAPTION_HEIGHT, axisDrawn } from '@jbrowse/display-ui'

import type { ScoreRuleMark, YAxis } from '@jbrowse/display-ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the two chrome shells read to draw a display's y axes: `axes` as
 * `ScoreScaleMixin` derives it from the display's `valueScales`, or as a
 * display whose every ladder is its own answers it directly, named
 * structurally so `DisplayChrome` and `renderDisplaySvg` detect it on any model
 * handed to them without importing the mixin. A host whose `axes` is empty
 * draws none.
 */
export interface AxisHost extends IStateTreeNode {
  axes: YAxis[]
  height: number
  canvasWidthPx: number
  /** Whether guide lines are ruled across the plot at each tick. */
  showCrossHatches?: boolean
  /** Rules the reader placed at chosen values, drawn over the hatches. */
  scoreRuleMarks?: ScoreRuleMark[]
}

export function isAxisHost(model: object): model is AxisHost {
  return 'axes' in model && 'canvasWidthPx' in model
}

/** The scales whose bands are too short for an axis, captioned instead. */
export function captionedAxes(model: AxisHost) {
  return model.axes.filter(axis => !axisDrawn(axis))
}

/** Px those captions take at the top-right, which the legend starts below. */
export function axisCaptionsReservedPx(model: AxisHost) {
  return captionedAxes(model).length * SCORE_CAPTION_HEIGHT
}
