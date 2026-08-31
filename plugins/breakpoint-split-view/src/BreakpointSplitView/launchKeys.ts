import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { BreakpointSplitViewCommands } from './types.ts'

// `views` is the view's one launch key and its one real discriminator: a row
// carrying `type` is a built LinearGenomeView snapshot MST restores, one
// without it is a recipe the init autorun opens. Model-guaranteed, since an
// LGV's `type` is a required literal. A list mixing the two indexes against
// neither, so the partition refuses it whole and afterAttach names it.
export const breakpointSplitLaunchKeys =
  defineLaunchKeys<BreakpointSplitViewCommands>()({
    views: { kind: 'rows' },
  })
