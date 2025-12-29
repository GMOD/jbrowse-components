import { useEffect } from 'react'

import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { IconButton } from '@mui/material'

import { usePopupState } from './hooks'

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
  const popupState = usePopupState()
  const { isOpen } = popupState

  useEffect(() => {
    setOpen?.(isOpen)
  }, [isOpen, setOpen])

  const isDisabled =
    disabled ?? (Array.isArray(menuItems) && menuItems.length === 0)

  return (
    <>
      <IconButton
        onClick={event => {
          if (stopPropagation) {
            event.stopPropagation()
          }
          popupState.open(event)
          onClickExtra?.(event)
        }}
        {...rest}
        disabled={isDisabled}
      >
        {children}
      </IconButton>
      {isOpen ? (
        <CascadingMenu
          popupState={popupState}
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
