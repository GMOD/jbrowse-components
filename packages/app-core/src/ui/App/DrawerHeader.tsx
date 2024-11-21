import React from 'react'
import { AppBar, IconButton, Toolbar, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

// locals
import DrawerWidgetSelector from './DrawerWidgetSelector'
import DrawerControls from './DrawerControls'

// icons
import LaunchIcon from '@mui/icons-material/Launch'

const useStyles = makeStyles()(theme => ({
  spacer: {
    flexGrow: 1,
  },

  headerFocused: {
    background: theme.palette.secondary.main,
  },
  headerUnfocused: {
    background: theme.palette.secondary.dark,
  },
}))

const DrawerHeader = observer(function ({
  session,
  setToolbarHeight,
  onPopoutDrawer,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
  setToolbarHeight: (arg: number) => void
  onPopoutDrawer: () => void
}) {
  const { classes } = useStyles()
  const focusedViewId = session.focusedViewId
  // @ts-ignore
  const viewWidgetId = session.visibleWidget?.view?.id

  return (
    <AppBar
      position="sticky"
      className={
        focusedViewId === viewWidgetId
          ? classes.headerFocused
          : classes.headerUnfocused
      }
      ref={ref => {
        setToolbarHeight(ref?.getBoundingClientRect().height || 0)
      }}
    >
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
        <Tooltip title="Open drawer in dialog">
          <IconButton
            color="inherit"
            onClick={() => {
              onPopoutDrawer()
            }}
          >
            <LaunchIcon />
          </IconButton>
        </Tooltip>
        <div className={classes.spacer} />
        <DrawerControls session={session} />
      </Toolbar>
    </AppBar>
  )
})

export default DrawerHeader
