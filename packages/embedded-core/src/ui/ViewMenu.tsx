import React, { useState } from 'react'
import {
  IconButton,
  IconButtonProps as IconButtonPropsType,
  SvgIconProps,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { Menu } from '@jbrowse/core/ui'

const ViewMenu = observer(function ({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  if (!model.menuItems()?.length) {
    return null
  }

  return (
    <>
      <IconButton
        {...IconButtonProps}
        aria-label="more"
        aria-controls="view-menu"
        aria-haspopup="true"
        onClick={event => setAnchorEl(event.currentTarget)}
        data-testid="view_menu_icon"
      >
        <MenuIcon {...IconProps} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => setAnchorEl(undefined)}
        menuItems={model.menuItems()}
      />
    </>
  )
})

export default ViewMenu
