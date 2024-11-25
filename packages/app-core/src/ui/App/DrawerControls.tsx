import React, { useState } from 'react'

// icons
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerControls = observer(function ({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { drawerPosition, visibleWidget } = session
  return (
    <>
      <IconButton
        color="inherit"
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Tooltip title="Minimize drawer">
        <IconButton
          data-testid="drawer-minimize"
          color="inherit"
          onClick={() => {
            session.notify(
              `Drawer minimized, click button on ${drawerPosition} side of screen to re-open`,
              'info',
            )
            session.minimizeWidgetDrawer()
          }}
        >
          <MinimizeIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Close drawer">
        <IconButton
          color="inherit"
          onClick={() => {
            session.hideWidget(visibleWidget)
          }}
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null)
        }}
      >
        {['left', 'right'].map(option => (
          <MenuItem
            key={option}
            selected={drawerPosition === 'option'}
            onClick={() => {
              session.setDrawerPosition(option)
              setAnchorEl(null)
            }}
          >
            {option}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
})

export default DrawerControls
