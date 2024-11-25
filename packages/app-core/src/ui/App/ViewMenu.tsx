import React from 'react'
import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { getSession } from '@jbrowse/core/util'

// icons
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import MenuIcon from '@mui/icons-material/Menu'
import { IconButton } from '@mui/material'
import {
  bindTrigger,
  bindPopover,
  usePopupState,
} from 'material-ui-popup-state/hooks'
import { observer } from 'mobx-react'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type {
  SvgIconProps,
  IconButtonProps as IconButtonPropsType,
} from '@mui/material'

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
                    ...(session.views.length > 2
                      ? [
                          {
                            label: 'Move view to top',
                            icon: KeyboardDoubleArrowUpIcon,
                            onClick: () => {
                              session.moveViewToTop(model.id)
                            },
                          },
                        ]
                      : []),
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
                    ...(session.views.length > 2
                      ? [
                          {
                            label: 'Move view to bottom',
                            icon: KeyboardDoubleArrowDownIcon,
                            onClick: () => {
                              session.moveViewToBottom(model.id)
                            },
                          },
                        ]
                      : []),
                  ],
                },
              ]
            : []),
          ...model.menuItems(),
        ]}
        popupState={popupState}
      />
    </>
  )
})
export default ViewMenu
