import React from 'react'
import {
  SvgIconProps,
  IconButton,
  IconButtonProps as IconButtonPropsType,
} from '@mui/material'
import { observer } from 'mobx-react'
import { AbstractSessionModel, getSession } from '@jbrowse/core/util'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import {
  bindTrigger,
  bindPopover,
  usePopupState,
} from 'material-ui-popup-state/hooks'
import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'

// icons
import MenuIcon from '@mui/icons-material/Menu'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'

const ViewMenu = observer(function ({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps?: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const { menuItems } = model
  const session = getSession(model) as AbstractSessionModel & {
    moveViewDown: (arg: string) => void
    moveViewUp: (arg: string) => void
  }

  const popupState = usePopupState({
    popupId: 'viewMenu',
    variant: 'popover',
  })

  const items = [
    ...(session.views.length > 1
      ? [
          {
            label: 'Move view up',
            icon: ArrowUpward,
            onClick: () => session.moveViewUp(model.id),
          },
          {
            label: 'Move view down',
            icon: ArrowDownward,
            onClick: () => session.moveViewDown(model.id),
          },
        ]
      : []),

    // <=1.3.3 didn't use a function, so check as value also
    ...((typeof menuItems === 'function' ? menuItems() : menuItems) || []),
  ]

  // note: This does not use CascadingMenuButton on purpose, because there was a confusing bug related to it!
  // see https://github.com/GMOD/jbrowse-components/issues/4115
  //
  // Make sure to test the Breakpoint split view menu checkboxes if you intend to change this
  return (
    <>
      <IconButton
        {...IconButtonProps}
        {...bindTrigger(popupState)}
        data-testid="view_menu_icon"
      >
        <MenuIcon {...IconProps} fontSize="small" />
      </IconButton>
      <CascadingMenu
        {...bindPopover(popupState)}
        onMenuItemClick={(_event: unknown, callback: () => void) => {
          callback()
        }}
        menuItems={items}
        popupState={popupState}
      />
    </>
  )
})
export default ViewMenu
