import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

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

/**
 * The drawer's chrome: the paper it sits on and the handle that resizes it.
 * Focus tracking is left to the caller through `ref`, since only the app shell
 * has a focused-view concept to wire it to.
 */
const Drawer = observer(function Drawer({
  session,
  children,
  ref,
}: {
  session: SessionWithDrawerWidgets
  children: React.ReactNode
  ref?: React.Ref<HTMLDivElement>
}) {
  const { drawerPosition, drawerWidth } = session
  const { classes } = useStyles()

  return (
    <Paper
      ref={ref}
      className={classes.paper}
      elevation={16}
      square
      data-testid="drawer-widget"
    >
      {children}
      <ResizeHandle
        onDrag={session.resizeDrawer}
        className={classes.resizeHandle}
        // the handle is position:fixed, so it sits on whichever edge faces the
        // main content regardless of where it lands in the DOM
        style={drawerPosition === 'left' ? { left: drawerWidth } : undefined}
        vertical
      />
    </Paper>
  )
})

export default Drawer
