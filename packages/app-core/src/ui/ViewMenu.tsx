import React, { useState } from 'react'
import {
  SvgIconProps,
  IconButton,
  IconButtonProps as IconButtonPropsType,
} from '@mui/material'
import { observer } from 'mobx-react'
import Menu from '@jbrowse/core/ui/Menu'
import { getSession } from '@jbrowse/core/util'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()
  const { menuItems } = model
  const session = getSession(model)

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

  return (
    <>
      <IconButton
        {...IconButtonProps}
        onClick={event => setAnchorEl(event.currentTarget)}
        data-testid="view_menu_icon"
      >
        <MenuIcon {...IconProps} fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_event, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => setAnchorEl(undefined)}
        menuItems={items}
      />
    </>
  )
})
export default ViewMenu
