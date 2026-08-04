import { getContainingView } from '@jbrowse/core/util'
import { reaction } from 'mobx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { IReactionDisposer } from 'mobx'

interface HoverHost extends IStateTreeNode {
  scrollTop: number
}

/**
 * Drop a display's hover state whenever the content moves under a stationary
 * cursor.
 *
 * A display that paints a sticky canvas has no DOM element travelling with its
 * features, so the browser fires no `mousemove` and no `mouseleave` when the
 * content moves and the pointer doesn't: the previously hovered feature's
 * tooltip stays pinned at the cursor, describing something that is no longer
 * under it. **Three axes move content, not one.** Zoom is the obvious one, but a
 * side-scroll or keyboard/locstring pan moves `offsetPx` with no pointer event
 * at all, and an internal wheel-scroll moves the display's own `scrollTop` —
 * which is the axis where the artifact is most visible, since a highlight box
 * derived from the hovered id *does* follow the feature and visibly walks away
 * from the tooltip. Alignments tracked only `bpPerPx` and had both other cases.
 *
 * A `reaction`, not an `autorun`, and that is load-bearing: the effect must be
 * able to read hover state (to skip a no-op clear) without that read becoming a
 * dependency — as an autorun, *setting* a hover would re-fire the body and
 * immediately clear it again. `reaction` runs its effect untracked by
 * construction, and skips the initial run, so nothing is cleared at attach.
 */
export function installClearHoverOnViewportChange(
  self: HoverHost,
  clear: () => void,
): IReactionDisposer {
  return reaction(
    () => {
      const view = getContainingView(self) as LinearGenomeViewModel
      return `${view.bpPerPx}-${view.offsetPx}-${self.scrollTop}`
    },
    clear,
    { name: 'ClearHoverOnViewportChange' },
  )
}
