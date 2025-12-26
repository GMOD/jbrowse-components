import { CascadingMenu } from '@jbrowse/core/ui'
import { bindPopover, bindTrigger, usePopupState } from '@jbrowse/core/ui/hooks'
import MenuIcon from '@mui/icons-material/Menu'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import type {
  IconButtonProps as IconButtonPropsType,
  SvgIconProps,
} from '@mui/material'

const ViewMenu = observer(function ViewMenu({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const popupState = usePopupState({
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
