import { useRef } from 'react'

import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { DRAWER_Z_INDEX } from '@jbrowse/core/ui/zIndexes'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import type { DrawerPosition } from '@jbrowse/core/util'

/**
 * All the chrome needs of a session, narrowed the way
 * `PreferencesDialogSession` is: the drawer is the one widget surface an
 * embedder can mount against a session of their own shape.
 */
export interface DrawerChromeSession {
  drawerPosition: DrawerPosition
  resizeDrawer: (distance: number, availableWidth?: number) => number
}

const useStyles = makeStyles()(theme => ({
  // The grid item. The handle is a flex sibling of the Paper, so it takes its
  // own 4px instead of covering the widget's edge text.
  root: {
    // the drawer places itself, so a host renders it once wherever it likes
    // rather than on the side matching `drawerPosition` (see
    // `drawerGridTemplateColumns`)
    gridColumn: 'drawer',
    display: 'flex',
    height: '100%',
    minWidth: 0,
  },
  paper: {
    overflowY: 'auto',
    height: '100%',
    flex: 1,
    minWidth: 0,
    // widgets position their own overlays against this
    position: 'relative',
    zIndex: DRAWER_Z_INDEX,
    outline: 'none',
    background: theme.palette.background.default,
  },
  resizeHandle: { flexShrink: 0 },
  handleForLeftDrawer: { order: 1 },
  handleForRightDrawer: { order: -1 },
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
  session: DrawerChromeSession
  children: React.ReactNode
  ref?: React.Ref<HTMLDivElement>
}) {
  const { drawerPosition } = session
  const { classes, cx } = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rootRef} className={classes.root}>
      <Paper
        ref={ref}
        className={classes.paper}
        elevation={16}
        square
        data-testid="drawer-widget"
      >
        {children}
      </Paper>
      <ResizeHandle
        onDrag={distance => {
          // the width the drawer and the main area share: both are columns of
          // the grid this is an item of, and the clamp needs the container
          // rather than the window
          session.resizeDrawer(
            distance,
            rootRef.current?.parentElement?.clientWidth,
          )
        }}
        className={cx(
          classes.resizeHandle,
          drawerPosition === 'left'
            ? classes.handleForLeftDrawer
            : classes.handleForRightDrawer,
        )}
        vertical
        bar
      />
    </div>
  )
})

export default Drawer
