import { Menu } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { Coord } from './types'
import type { BaseLinearDisplayModel } from '../model'

const MenuPage = observer(function ({
  onClose,
  contextCoord,
  model,
}: {
  model: BaseLinearDisplayModel
  contextCoord: Coord
  onClose: () => void
}) {
  const items = model.contextMenuItems()
  return (
    <Menu
      open={items.length > 0}
      onMenuItemClick={(_, callback) => {
        callback()
        onClose()
      }}
      onClose={() => {
        onClose()
        model.setContextMenuFeature(undefined)
      }}
      slotProps={{
        transition: {
          onExit: () => {
            onClose()
            model.setContextMenuFeature(undefined)
          },
        },
      }}
      anchorReference="anchorPosition"
      anchorPosition={{
        top: contextCoord[1],
        left: contextCoord[0],
      }}
      menuItems={items}
    />
  )
})

export default MenuPage
