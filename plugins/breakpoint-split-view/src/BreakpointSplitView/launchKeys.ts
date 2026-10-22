import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { BreakpointSplitViewCommands } from './types.ts'

// `views` is the view's one launch key and its one real discriminator: a row
// carrying `type` is a built LinearGenomeView snapshot MST restores, one
// without it is a recipe the init autorun opens. Model-guaranteed, since an
// LGV's `type` is a required literal. A list mixing the two indexes against
// neither, so the partition refuses it whole and afterAttach names it.
//
// `height` is deprecated: v4's height of the whole view, which the panels'
// own heights replaced. It passes through so a saved session carrying it
// raises no typo warning, and MST drops it.
export const breakpointSplitLaunchKeys =
  defineLaunchKeys<BreakpointSplitViewCommands>()(
    {
      views: { kind: 'rows' },
    },
    { passThrough: ['height'] },
  )
