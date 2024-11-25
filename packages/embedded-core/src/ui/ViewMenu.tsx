import React from 'react'
import { CascadingMenu } from '@jbrowse/core/ui'
import MenuIcon from '@mui/icons-material/Menu'
import { IconButton } from '@mui/material'
import {
  bindTrigger,
  bindPopover,
  usePopupState,
} from 'material-ui-popup-state/hooks'
import { observer } from 'mobx-react'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import type {
  IconButtonProps as IconButtonPropsType,
  SvgIconProps,
} from '@mui/material'

const ViewMenu = observer(function ({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const popupState = usePopupState({
    popupId: 'viewMenu',
    variant: 'popover',
  })
  return (
    <>
      <IconButton
        {...IconButtonProps}
        {...bindTrigger(popupState)}
        data-testid="view_menu_icon"
      >
        <MenuIcon {...IconProps} />
      </IconButton>
      <CascadingMenu
        {...bindPopover(popupState)}
        onMenuItemClick={(_event: unknown, callback: () => void) => {
          callback()
        }}
        menuItems={model.menuItems()}
        popupState={popupState}
      />
    </>
  )
})

export default ViewMenu
