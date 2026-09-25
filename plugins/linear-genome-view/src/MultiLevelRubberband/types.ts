import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Structural model shape shared by LinearSyntenyView and BreakpointSplitView:
// a stack of LGV levels plus the two rubberband menus — one for a drag, one for
// a bare click. Both on the model, like the linear genome view's, so a plugin
// can contribute to either through `addViewMenuItems`.
export interface MultiLevelRubberbandModel {
  views: LinearGenomeViewModel[]
  rubberBandMenuItems: () => MenuItem[]
  rubberbandClickMenuItems: (px: number) => MenuItem[]
}
