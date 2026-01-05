import { useEffect, useState } from 'react'

import { IconButton } from '@mui/material'

import CascadingMenu from './CascadingMenu'

import type { MenuItemsGetter } from './CascadingMenu'

function CascadingMenuButton({
  children,
  menuItems,
  closeAfterItemClick = true,
  stopPropagation,
  disabled,
  setOpen,
  ButtonComponent = IconButton,
  onClick: onClickExtra,
  anchorOrigin,
  transformOrigin,
  marginThreshold,
  ...rest
}: {
  children?: React.ReactNode
  menuItems: MenuItemsGetter
  closeAfterItemClick?: boolean
  stopPropagation?: boolean
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  setOpen?: (arg: boolean) => void
  ButtonComponent?: React.FC<{
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    children?: React.ReactNode
  }>
  anchorOrigin?: {
    vertical: 'top' | 'center' | 'bottom'
    horizontal: 'left' | 'center' | 'right'
  }
  transformOrigin?: {
    vertical: 'top' | 'center' | 'bottom'
    horizontal: 'left' | 'center' | 'right'
  }
  marginThreshold?: number | null
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
      <ButtonComponent
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
      </ButtonComponent>
      {open ? (
        <CascadingMenu
          open={open}
          onClose={() => {
            setAnchorEl(null)
          }}
          anchorEl={anchorEl}
          anchorOrigin={anchorOrigin}
          transformOrigin={transformOrigin}
          marginThreshold={marginThreshold}
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
