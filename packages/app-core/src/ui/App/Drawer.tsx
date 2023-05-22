import React from 'react'
import { Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { SessionWithDrawerWidgets } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  paper: {
    overflowY: 'auto',
    height: '100%',
    zIndex: theme.zIndex.drawer,
    outline: 'none',
    background: theme.palette.background.default,
  },
  resizeHandle: {
    width: 4,
    position: 'fixed',
    top: 0,
    zIndex: theme.zIndex.drawer + 1,
  },
}))

function Drawer({
  children,
  session,
}: {
  children: React.ReactNode
  session: SessionWithDrawerWidgets
}) {
  const { drawerPosition, drawerWidth } = session
  const { classes } = useStyles()

  return (
    <Paper className={classes.paper} elevation={16} square>
      {drawerPosition === 'right' ? (
        <ResizeHandle
          onDrag={session.resizeDrawer}
          className={classes.resizeHandle}
          vertical
        />
      ) : null}
      {children}
      {drawerPosition === 'left' ? (
        <ResizeHandle
          onDrag={session.resizeDrawer}
          className={classes.resizeHandle}
          style={{ left: drawerWidth }}
          vertical
        />
      ) : null}
    </Paper>
  )
}

export default observer(Drawer)
