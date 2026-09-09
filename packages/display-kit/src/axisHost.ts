import type { ScoreRuleMark, YScaleTicks } from '@jbrowse/display-ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the two chrome shells read to draw a display's y axis: the members
 * `ScoreScaleMixin` brings, named structurally so `DisplayChrome` and
 * `renderDisplaySvg` detect the mixin on any model handed to them without
 * importing it. A host whose `valueScale` is unset draws no axis.
 */
export interface AxisHost extends IStateTreeNode {
  valueScale: unknown
  ticks: YScaleTicks | undefined
  height: number
  canvasWidthPx: number
  /** Whether guide lines are ruled across the plot at each tick. */
  showCrossHatches?: boolean
  /** Rules the reader placed at chosen values, drawn over the hatches. */
  scoreRuleMarks?: ScoreRuleMark[]
}

export function isAxisHost(model: object): model is AxisHost {
  return 'valueScale' in model && 'ticks' in model && 'canvasWidthPx' in model
}

/** The ticks the chrome draws, if the host declared a scale and one resolved. */
export function axisTicks(model: AxisHost) {
  return model.valueScale ? model.ticks : undefined
}
