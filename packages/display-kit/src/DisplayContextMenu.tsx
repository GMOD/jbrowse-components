import ContextMenu from '@jbrowse/core/ui/ContextMenu'
import { observer } from 'mobx-react'

import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'

/**
 * What `DisplayChrome` reads to draw a display's right-click menu: the members
 * `ContextMenuMixin` brings plus the display's `contextMenuItems`, named
 * structurally so the chrome detects the mixin on any model handed to it.
 */
export interface ContextMenuHost {
  contextMenuInfo?: ContextMenuAnchor
  contextMenuItems: () => MenuItem[]
  closeContextMenu: () => void
}

export function isContextMenuHost(model: object): model is ContextMenuHost {
  return 'contextMenuInfo' in model && 'contextMenuItems' in model
}

/**
 * Open a display's right-click menu from the event that asked for it, with the
 * one rule every display owes spelled once: **`preventDefault` only when a menu
 * opens.** A right-click on the inter-region gutter, on an overlay that owns its
 * own menu, or on a position whose items come back empty falls through to the
 * browser's menu instead of being a dead zone — on a canvas, suppressing it and
 * showing nothing costs the reader "Save image as…".
 *
 * `info` is the resolved anchor, or `undefined` for a right-click that hit
 * nothing. The menu is opened before its items are asked for, because a display
 * builds them from the anchor; an empty answer closes it again with the default
 * intact. The menu, once open, drops the chrome's pointer and the hover with
 * it (`ContextMenu`), so the tooltip and crosshair don't sit behind it.
 */
export function openContextMenuFromEvent<Info extends ContextMenuAnchor>(
  model: {
    openContextMenu: (info: Info) => void
    closeContextMenu: () => void
    contextMenuItems: () => MenuItem[]
  },
  event: { preventDefault: () => void },
  info: Info | undefined,
) {
  if (info !== undefined) {
    model.openContextMenu(info)
    if (model.contextMenuItems().length === 0) {
      model.closeContextMenu()
    } else {
      event.preventDefault()
    }
  }
}

/**
 * The right-click menu of a display composing `ContextMenuMixin`, which
 * `DisplayChrome` renders for every such display. An observer of its own, so
 * opening the menu re-renders this and not the chrome.
 */
export const DisplayContextMenu = observer(function DisplayContextMenu({
  model,
}: {
  model: ContextMenuHost
}) {
  return (
    <ContextMenu
      anchor={model.contextMenuInfo}
      menuItems={() => model.contextMenuItems()}
      onClose={() => {
        model.closeContextMenu()
      }}
    />
  )
})
