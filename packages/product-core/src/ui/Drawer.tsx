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
  // The grid item, and the handle's containing block. Its own box rather than
  // the Paper's because the Paper is the thing that SCROLLS: a handle
  // positioned against it starts at the top of the scrolled content and rides
  // away with it, and one taken out of flow with `position: fixed` is measured
  // against the window instead — which is the same box only in a full-window
  // app, and put a page-tall col-resize strip down an embedded view's page.
  root: {
    // the drawer places itself, so a host renders it once wherever it likes
    // rather than on the side matching `drawerPosition` (see
    // `drawerGridTemplateColumns`)
    gridColumn: 'drawer',
    position: 'relative',
    height: '100%',
    minWidth: 0,
  },
  paper: {
    overflowY: 'auto',
    height: '100%',
    // widgets position their own overlays against this
    position: 'relative',
    zIndex: DRAWER_Z_INDEX,
    outline: 'none',
    background: theme.palette.background.default,
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    zIndex: DRAWER_Z_INDEX + 1,
  },
  // whichever edge faces the main content
  handleForLeftDrawer: { right: 0 },
  handleForRightDrawer: { left: 0 },
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
