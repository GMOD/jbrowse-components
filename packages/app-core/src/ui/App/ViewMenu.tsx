import React from 'react'
import {
  SvgIconProps,
  IconButtonProps as IconButtonPropsType,
} from '@mui/material'
import { observer } from 'mobx-react'
import { AbstractSessionModel, getSession } from '@jbrowse/core/util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import MenuIcon from '@mui/icons-material/Menu'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'

const ViewMenu = observer(function ({
  model,
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

  return items.length ? (
    <CascadingMenuButton menuItems={items} data-testid="view_menu_icon">
      <MenuIcon {...IconProps} fontSize="small" />
    </CascadingMenuButton>
  ) : null
})
export default ViewMenu
