import { useRef } from 'react'

import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { useFocusOnInteraction } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  paper: {
    overflowY: 'auto',
    height: '100%',
    position: 'relative',
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

const Drawer = observer(function Drawer({
  children,
  session,
}: {
  children: React.ReactNode
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { drawerPosition, drawerWidth } = session
  const { classes } = useStyles()
  const ref = useRef<HTMLDivElement>(null)

  useFocusOnInteraction(ref, () => {
    const visibleWidgetId = session.visibleWidget?.view?.id
    if (visibleWidgetId) {
      session.setFocusedViewId(visibleWidgetId)
    }
  })

  return (
    <Paper
      ref={ref}
      className={classes.paper}
      elevation={16}
      square
      data-testid="drawer-widget"
    >
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
})

export default Drawer
