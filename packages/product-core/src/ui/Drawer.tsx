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
  drawerWidth: number
  /** the width the drawer is drawn at, when it can differ from `drawerWidth` */
  effectiveDrawerWidth?: number
  updateDrawerWidth: (drawerWidth: number, availableWidth?: number) => number
  visibleWidget?: { overlayDrawerWidth?: number }
}

const useStyles = makeStyles()(theme => ({
  // The grid item. The handle is a flex sibling of the Paper, so it takes its
  // own 4px instead of covering the widget's edge text.
  root: {
    // the drawer places itself, so a host renders it once wherever it likes
    // rather than on the side matching `drawerPosition` (see
    // `drawerGridTemplateColumns`)
    gridColumn: 'drawer',
    // the last row: a drawer with no row of its own auto-places after the
    // main item and drops to a new row when it sits on the left
    gridRow: '-2 / -1',
    display: 'flex',
    height: '100%',
    minWidth: 0,
  },
  // the paper's place in the column; a widget asking for an overlay width
  // slides the paper out from here over the views, which keep their width
  slot: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  paper: {
    overflowY: 'auto',
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    zIndex: DRAWER_Z_INDEX,
    outline: 'none',
    background: theme.palette.background.default,
    transition: 'width 200ms ease-out',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
  paperForLeftDrawer: { left: 0 },
  paperForRightDrawer: { right: 0 },
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
  const overlayWidth = session.visibleWidget?.overlayDrawerWidth
  const { classes, cx } = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rootRef} className={classes.root} data-drawer-column>
      <div className={classes.slot}>
        <Paper
          ref={ref}
          className={cx(
            classes.paper,
            drawerPosition === 'left'
              ? classes.paperForLeftDrawer
              : classes.paperForRightDrawer,
          )}
          style={overlayWidth ? { width: overlayWidth } : undefined}
          elevation={16}
          square
          data-testid="drawer-widget"
        >
          {children}
        </Paper>
      </div>
      <ResizeHandle
        value={session.effectiveDrawerWidth ?? session.drawerWidth}
        // the handle is on the drawer's inner edge, so toward a right drawer
        // narrows it
        reverse={drawerPosition === 'right'}
        onChange={width => {
          // the width the drawer and the main area share: both are columns of
          // the grid this is an item of, and the clamp needs the container
          // rather than the window
          session.updateDrawerWidth(
            width,
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
