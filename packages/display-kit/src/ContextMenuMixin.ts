import { types } from '@jbrowse/mobx-state-tree'

import type { ContextMenuAnchor } from '@jbrowse/core/ui'

/**
 * #stateModel ContextMenuMixin
 * #category display
 * #crossCuttingMixin The right-click state of a display whose menu acts on a
 * position: the anchor plus whatever the click resolved to (a genomic column,
 * a feature), held as one value so the menu's open-ness and the position its
 * items act on cannot disagree. Brings `contextMenuInfo`, `openContextMenu`
 * and `closeContextMenu`; the display supplies `contextMenuItems()`, and
 * `DisplayContextMenu` renders the two together
 *
 * `Info` is the display's own resolution of the click — the multi-row painting
 * carries the feature under it, multi-wiggle and MAF a column — and every one
 * of them carries the anchor. The items are built from this value when the
 * menu opens, not read inside an item's `onClick`, because `closeContextMenu`
 * runs first when an item is clicked.
 */
export function ContextMenuMixin<Info extends ContextMenuAnchor>() {
  return types
    .model('ContextMenuMixin', {})
    .volatile(() => ({
      contextMenuInfo: undefined as Info | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      openContextMenu(info: Info) {
        self.contextMenuInfo = info
      },
      /**
       * #action
       */
      closeContextMenu() {
        self.contextMenuInfo = undefined
      },
    }))
}
