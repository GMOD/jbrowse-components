import { useEffect, useState } from 'react'

import Menu from '@jbrowse/core/ui/Menu'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { MenuItemsGetter } from '@jbrowse/core/ui/Menu'

const MenuButton = observer(function MenuButton({
  children,
  menuItems,
  closeAfterItemClick = true,
  stopPropagation,
  setOpen,
  ...rest
}: {
  closeAfterItemClick?: boolean
  children?: React.ReactElement
  menuItems: MenuItemsGetter
  stopPropagation?: boolean
  setOpen?: (arg: boolean) => void
  [key: string]: unknown
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement>()
  const isOpen = !!anchorEl
  useEffect(() => {
    setOpen?.(isOpen)
  }, [isOpen, setOpen])
  return (
    <>
      <IconButton
        {...rest}
        onClick={event => {
          if (stopPropagation) {
            event.stopPropagation()
          }
          setAnchorEl(event.currentTarget)
        }}
        disabled={Array.isArray(menuItems) && menuItems.length === 0}
      >
        {children}
      </IconButton>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(undefined)
        }}
        onMenuItemClick={(_: unknown, callback: () => void) => {
          callback()
          if (closeAfterItemClick) {
            setAnchorEl(undefined)
          }
        }}
        menuItems={menuItems}
      />
    </>
  )
})

export default MenuButton
