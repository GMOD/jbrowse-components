import { getContainingView } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from './model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The containing view as the linear genome view itself, for a display that
 * needs `pxToBp`, `showTrack`, `navTo` or the view's own chrome settings.
 *
 * The twin of display-kit's `containingHost`, and deliberately not the same
 * function: `RegionHost` is the region contract display-kit reads, and widening
 * it to carry the LGV's own surface is how the display layer would come to
 * depend on the view plugin. A display that wants the view names the view.
 *
 * Components and structural helpers taking duck-typed model shapes keep calling
 * `getContainingView` — the same carve-out `containingHost` documents.
 */
export function containingLgv(self: IStateTreeNode) {
  return getContainingView(self) as LinearGenomeViewModel
}
