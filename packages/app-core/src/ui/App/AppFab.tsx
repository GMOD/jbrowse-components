import React from 'react'
import LaunchIcon from '@mui/icons-material/Launch'
import { Fab, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

// icons

const useStyles = makeStyles()(theme => ({
  left: {
    zIndex: 10000,
    position: 'fixed',
    bottom: theme.spacing(2),
    left: theme.spacing(2),
  },
  right: {
    zIndex: 10000,
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
}))

const AppFab = observer(function ({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { minimized, activeWidgets, drawerPosition } = session
  const { classes } = useStyles()

  return activeWidgets.size > 0 && minimized ? (
    <Tooltip title="Open drawer widget">
      <Fab
        className={drawerPosition === 'right' ? classes.right : classes.left}
        color="primary"
        data-testid="drawer-maximize"
        onClick={() => {
          session.showWidgetDrawer()
        }}
      >
        <LaunchIcon />
      </Fab>
    </Tooltip>
  ) : null
})

export default AppFab
