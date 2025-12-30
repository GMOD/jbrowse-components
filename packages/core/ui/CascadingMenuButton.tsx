import { useEffect, useState } from 'react'

import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { IconButton } from '@mui/material'

import type { MenuItemsGetter } from '@jbrowse/core/ui/CascadingMenu'

function CascadingMenuButton({
  children,
  menuItems,
  closeAfterItemClick = true,
  stopPropagation,
  disabled,
  setOpen,
  onClick: onClickExtra,
  ...rest
}: {
  children?: React.ReactElement
  menuItems: MenuItemsGetter
  closeAfterItemClick?: boolean
  stopPropagation?: boolean
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  setOpen?: (arg: boolean) => void
  [key: string]: unknown
}) {
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)
  const open = Boolean(anchorEl)

  useEffect(() => {
    setOpen?.(open)
  }, [open, setOpen])

  const isDisabled =
    disabled ?? (Array.isArray(menuItems) && menuItems.length === 0)

  return (
    <>
      <IconButton
        onClick={event => {
          if (stopPropagation) {
            event.stopPropagation()
          }
          setAnchorEl(event.currentTarget)
          onClickExtra?.(event)
        }}
        {...rest}
        disabled={isDisabled}
      >
        {children}
      </IconButton>
      {open ? (
        <CascadingMenu
          open={open}
          onClose={() => setAnchorEl(null)}
          anchorEl={anchorEl}
          menuItems={menuItems}
          closeAfterItemClick={closeAfterItemClick}
          onMenuItemClick={(_: unknown, callback: () => void) => {
            callback()
          }}
        />
      ) : null}
    </>
  )
}

export default CascadingMenuButton
