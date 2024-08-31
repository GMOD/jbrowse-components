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
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'

const ViewMenu = observer(function ({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps?: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const session = getSession(model) as AbstractSessionModel & {
    moveViewDown: (arg: string) => void
    moveViewUp: (arg: string) => void
    moveViewToBottom: (arg: string) => void
    moveViewToTop: (arg: string) => void
  }

  const popupState = usePopupState({
    popupId: 'viewMenu',
    variant: 'popover',
  })

  // note: This does not use CascadingMenuButton on purpose, because there was
  // a confusing bug related to it! see
  // https://github.com/GMOD/jbrowse-components/issues/4115
  //
  // Make sure to test the Breakpoint split view menu checkboxes if you intend
  // to change this
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
        menuItems={[
          ...(session.views.length > 1
            ? [
                {
                  label: 'View order',
                  type: 'subMenu' as const,
                  subMenu: [
                    {
                      label: 'Move view to top',
                      icon: KeyboardDoubleArrowUpIcon,
                      onClick: () => {
                        session.moveViewToTop(model.id)
                      },
                    },
                    {
                      label: 'Move view up',
                      icon: KeyboardArrowUpIcon,
                      onClick: () => {
                        session.moveViewUp(model.id)
                      },
                    },
                    {
                      label: 'Move view down',
                      icon: KeyboardArrowDownIcon,
                      onClick: () => {
                        session.moveViewDown(model.id)
                      },
                    },
                    {
                      label: 'Move view to bottom',
                      icon: KeyboardDoubleArrowDownIcon,
                      onClick: () => {
                        session.moveViewToBottom(model.id)
                      },
                    },
                  ],
                },
              ]
            : []),
          model.menuItems(),
        ]}
        popupState={popupState}
      />
    </>
  )
})
export default ViewMenu
