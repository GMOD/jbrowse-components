import React from 'react'
import { Fab, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { SessionWithDrawerWidgets } from '@jbrowse/core/util'

// icons
import LaunchIcon from '@mui/icons-material/Launch'

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

export default observer(function AppFab({
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
        onClick={() => session.showWidgetDrawer()}
      >
        <LaunchIcon />
      </Fab>
    </Tooltip>
  ) : null
})
