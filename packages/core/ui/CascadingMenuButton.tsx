import React from 'react'
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
  ...rest
}: {
  children?: React.ReactElement
  menuItems: MenuItem[]
  [key: string]: unknown
}) {
  const popupState = usePopupState({
    popupId: 'viewMenu',
    variant: 'popover',
  })
  return (
    <>
      <IconButton
        {...bindTrigger(popupState)}
        {...rest}
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
