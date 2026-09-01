import { ContextMenu } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'

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
 * intact. The hover is cleared last, and only for a menu that stayed open, so
 * the tooltip and crosshair don't sit behind it.
 */
export function openContextMenuFromEvent<Info extends ContextMenuAnchor>(
  model: {
    openContextMenu: (info: Info) => void
    closeContextMenu: () => void
    contextMenuItems: () => MenuItem[]
    clearHoveredFeature: () => void
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
      model.clearHoveredFeature()
    }
  }
}

/**
 * The right-click menu of a display composing `ContextMenuMixin`, in an
 * observer of its own: reading `contextMenuInfo` in the component that mounts
 * `DisplayChrome` would attribute it to the chrome's observer and re-render
 * the whole subtree on every open.
 */
export const DisplayContextMenu = observer(function DisplayContextMenu({
  model,
}: {
  model: {
    contextMenuInfo?: ContextMenuAnchor
    contextMenuItems: () => MenuItem[]
    closeContextMenu: () => void
  }
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
