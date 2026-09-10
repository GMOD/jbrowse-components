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
 * A view that lays its displays along a strip of its own — the circular view's
 * ring host — is answered here too, the way `containingHost` answers it: the
 * strip carries the members a display reads to draw (`bpToPx`, `pxToBp`, the
 * blocks), and a display drawn there that reaches for a member the strip has
 * not is the display that stays off the circle.
 *
 * Components and structural helpers taking duck-typed model shapes keep calling
 * `getContainingView` — the same carve-out `containingHost` documents.
 */
export function containingLgv(self: IStateTreeNode) {
  const view = getContainingView(self)
  return (view.regionHost ?? view) as LinearGenomeViewModel
}
