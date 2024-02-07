import React, { Suspense, lazy } from 'react'
import { AppBar } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'
import Snackbar from '@jbrowse/core/ui/Snackbar'
import { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'

// locals
import AppToolbar from './AppToolbar'
import ViewLauncher from './ViewLauncher'
import StaticViewPanel from './StaticViewPanel'
import FloatingViewPanel from './FloatingViewPanel'
import DialogQueue from './DialogQueue'
import AppFab from './AppFab'

const DrawerWidget = lazy(() => import('./DrawerWidget'))

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'grid',
    height: '100vh',
    width: '100%',
    colorScheme: theme.palette.mode,
  },
  appContainer: {
    gridColumn: 'main',
    display: 'grid',
    gridTemplateRows: '[menubar] min-content [components] auto',
    height: '100vh',
  },
  viewContainer: {
    overflowY: 'auto',
    gridRow: 'components',
  },
  appBar: {
    flexGrow: 1,
    gridRow: 'menubar',
  },
}))

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithFocusedViewAndDrawerWidgets & {
    savedSessionNames: string[]
    menus: { label: string; menuItems: JBMenuItem[] }[]
    renameCurrentSession: (arg: string) => void
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
  }
}

const LazyDrawerWidget = observer(function (props: Props) {
  const { session } = props
  return (
    <Suspense fallback={null}>
      <DrawerWidget session={session} />
    </Suspense>
  )
})

const ViewContainer = observer(function (props: Props) {
  const { session } = props
  const { views } = session
  const { classes } = useStyles()
  return (
    <div className={classes.viewContainer}>
      {views.length > 0 ? (
        views.map(view =>
          view.floating ? (
            <FloatingViewPanel
              key={`view-${view.id}`}
              view={view}
              session={session}
            />
          ) : (
            <StaticViewPanel
              key={`view-${view.id}`}
              view={view}
              session={session}
            />
          ),
        )
      ) : (
        <ViewLauncher {...props} />
      )}

      {/* blank space at the bottom of screen allows scroll */}
      <div style={{ height: 300 }} />
    </div>
  )
})

const AppContainer = observer(function (props: Props) {
  const { classes } = useStyles()
  return (
    <div className={classes.appContainer}>
      <AppBar className={classes.appBar} position="static">
        <AppToolbar {...props} />
      </AppBar>
      <ViewContainer {...props} />
    </div>
  )
})

const DrawerWrapper = observer(function (
  props: Props & { children: React.ReactNode },
) {
  const { children } = props
  const { classes } = useStyles()
  const { session } = props
  const { minimized, visibleWidget, drawerWidth, drawerPosition } = session
  const drawerVisible = visibleWidget && !minimized
  const d = drawerVisible ? `[drawer] ${drawerWidth}px` : undefined

  const grid =
    drawerPosition === 'right' ? ['[main] 1fr', d] : [d, '[main] 1fr']
  return (
    <div
      className={classes.root}
      style={{ gridTemplateColumns: grid?.filter(f => !!f).join(' ') }}
    >
      {drawerVisible && drawerPosition === 'left' ? (
        <LazyDrawerWidget session={session} />
      ) : null}

      {children}

      {drawerVisible && drawerPosition === 'right' ? (
        <LazyDrawerWidget session={session} />
      ) : null}
    </div>
  )
})

const App = observer(function (props: Props) {
  const { session } = props
  return (
    <DrawerWrapper {...props}>
      <DialogQueue session={session} />
      <AppContainer {...props} />
      <AppFab session={session} />
      <Snackbar session={session} />
    </DrawerWrapper>
  )
})

export { App }
