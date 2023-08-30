import React from 'react'
import {
  IconButtonProps as IconButtonPropsType,
  SvgIconProps,
} from '@mui/material'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

// icons
import MenuIcon from '@mui/icons-material/Menu'

const ViewMenu = observer(function ({
  model,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const items = model.menuItems()
  return items.length ? (
    <CascadingMenuButton menuItems={items} data-testid="view_menu_icon">
      <MenuIcon {...IconProps} />
    </CascadingMenuButton>
  ) : null
})

export default ViewMenu
