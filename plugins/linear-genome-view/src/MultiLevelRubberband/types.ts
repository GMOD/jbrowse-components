import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Structural model shape shared by LinearComparativeView and BreakpointSplitView:
// a stack of LGV levels plus the rubberband context menu.
export interface MultiLevelRubberbandModel {
  views: LinearGenomeViewModel[]
  rubberBandMenuItems: () => MenuItem[]
}
