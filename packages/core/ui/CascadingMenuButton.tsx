import React, { useEffect } from 'react'
import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import {
  bindTrigger,
  bindPopover,
  usePopupState,
} from 'material-ui-popup-state/hooks'
import { MenuItem } from '@jbrowse/core/ui'

const CascadingMenuButton = observer(function CascadingMenuButton({
  children,
  menuItems,
  onMenuOpen,
  onMenuClose,
  onClickExtra,
  onTouchExtra,
  ...rest
}: {
  children?: React.ReactElement
  menuItems: MenuItem[]
  onClickExtra?: (event: React.MouseEvent) => void
  onTouchExtra?: (event: React.TouchEvent) => void
  onMenuOpen?: () => void
  onMenuClose?: () => void
  [key: string]: unknown
}) {
  const popupState = usePopupState({
    popupId: 'viewMenu',
    variant: 'popover',
  })

  useEffect(() => {
    if (popupState.isOpen) {
      onMenuOpen?.()
    } else {
      onMenuClose?.()
    }
  }, [popupState.isOpen, onMenuOpen, onMenuClose])
  const eventHandlers = bindTrigger(popupState)
  return (
    <>
      <IconButton
        {...eventHandlers}
        {...rest}
        onTouchStart={event => {
          onTouchExtra?.(event)
          eventHandlers.onTouchStart(event)
        }}
        onClick={event => {
          onClickExtra?.(event)
          eventHandlers.onClick(event)
        }}
        disabled={menuItems.length === 0}
      >
        {children}
      </IconButton>
      <CascadingMenu
        {...bindPopover(popupState)}
        onMenuItemClick={(_: unknown, callback: () => void) => callback()}
        menuItems={menuItems}
        popupState={popupState}
      />
    </>
  )
})

export default CascadingMenuButton
