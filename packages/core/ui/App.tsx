import React, { Suspense } from 'react'
import { AppBar, Fab, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import LaunchIcon from '@mui/icons-material/Launch'
import { observer } from 'mobx-react'

// locals
import {
  NotificationLevel,
  SessionWithDrawerWidgets,
  SnackAction,
} from '../util'

// ui elements
import DrawerWidget from './DrawerWidget'
import AppToolbar from './AppToolbar'
import Snackbar from './Snackbar'
import ViewLauncher from './ViewLauncher'
import { MenuItem as JBMenuItem } from './Menu'
import ViewPanel from './ViewPanel'

const useStyles = makeStyles()(theme => ({
  root: {
    fontFamily: 'Roboto',
    display: 'grid',
    height: '100vh',
    width: '100%',
    colorScheme: theme.palette.mode,
  },
  fabLeft: {
    zIndex: 10000,
    position: 'fixed',
    bottom: theme.spacing(2),
    left: theme.spacing(2),
  },
  fabRight: {
    zIndex: 10000,
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  menuBarAndComponents: {
    gridColumn: 'main',
    display: 'grid',
    gridTemplateRows: '[menubar] min-content [components] auto',
    height: '100vh',
  },
  menuBar: {
    gridRow: 'menubar',
  },
  components: {
    overflowY: 'auto',
    gridRow: 'components',
  },
  appBar: {
    flexGrow: 1,
  },
}))

type SnackbarMessage = [string, NotificationLevel, SnackAction]

const App = observer(function (props: {
  HeaderButtons?: React.ReactElement
  session: SessionWithDrawerWidgets & {
    savedSessionNames: string[]
    menus: { label: string; menuItems: JBMenuItem[] }[]
    renameCurrentSession: (arg: string) => void
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
  }
}) {
  const { session } = props
  const { classes } = useStyles()

  const {
    minimized,
    visibleWidget,
    drawerWidth,
    activeWidgets,
    views,
    drawerPosition,
  } = session

  const drawerVisible = visibleWidget && !minimized

  let grid
  if (drawerPosition === 'right') {
    grid = [
      `[main] 1fr`,
      drawerVisible ? `[drawer] ${drawerWidth}px` : undefined,
    ]
  } else if (drawerPosition === 'left') {
    grid = [
      drawerVisible ? `[drawer] ${drawerWidth}px` : undefined,
      `[main] 1fr`,
    ]
  }
  return (
    <div
      className={classes.root}
      style={{
        gridTemplateColumns: grid?.filter(f => !!f).join(' '),
      }}
    >
      {drawerVisible && drawerPosition === 'left' ? (
        <DrawerWidget session={session} />
      ) : null}

      {session.DialogComponent ? (
        <Suspense fallback={<div />}>
          <session.DialogComponent {...session.DialogProps} />
        </Suspense>
      ) : null}
      <div className={classes.menuBarAndComponents}>
        <div className={classes.menuBar}>
          <AppBar className={classes.appBar} position="static">
            <AppToolbar {...props} />
          </AppBar>
        </div>
        <div className={classes.components}>
          {views.length > 0 ? (
            views.map(view => (
              <ViewPanel
                key={`view-${view.id}`}
                view={view}
                session={session}
              />
            ))
          ) : (
            <ViewLauncher {...props} />
          )}

          {/* blank space at the bottom of screen allows scroll */}
          <div style={{ height: 300 }} />
        </div>
      </div>

      {activeWidgets.size > 0 && minimized ? (
        <Tooltip title="Open drawer widget">
          <Fab
            className={
              drawerPosition === 'right' ? classes.fabRight : classes.fabLeft
            }
            color="primary"
            data-testid="drawer-maximize"
            onClick={() => session.showWidgetDrawer()}
          >
            <LaunchIcon />
          </Fab>
        </Tooltip>
      ) : null}

      {drawerVisible && drawerPosition === 'right' ? (
        <DrawerWidget session={session} />
      ) : null}

      <Snackbar session={session} />
    </div>
  )
})

export default App
