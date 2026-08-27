import { ContextMenu } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'

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
