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
import DialogQueue from './DialogQueue'
import AppFab from './AppFab'
import ViewsContainer from './ViewsContainer'

// lazies
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

  appBar: {
    flexGrow: 1,
    gridRow: 'menubar',
  },
}))

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithFocusedViewAndDrawerWidgets & {
    savedSessionNames: string[]
    menus: {
      label: string
      menuItems: JBMenuItem[]
    }[]
    snackbarMessages: SnackbarMessage[]
    renameCurrentSession: (arg: string) => void
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

const App = observer(function (props: Props) {
  const { session } = props
  const { classes } = useStyles()
  const { minimized, visibleWidget, drawerWidth, drawerPosition } = session
  const drawerVisible = visibleWidget && !minimized
  const d = drawerVisible ? `[drawer] ${drawerWidth}px` : undefined
  const grid =
    drawerPosition === 'right' ? ['[main] 1fr', d] : [d, '[main] 1fr']

  return (
    <div
      className={classes.root}
      style={{ gridTemplateColumns: grid.filter(f => !!f).join(' ') }}
    >
      {drawerVisible && drawerPosition === 'left' ? (
        <LazyDrawerWidget session={session} />
      ) : null}
      <DialogQueue session={session} />
      <div className={classes.appContainer}>
        <AppBar className={classes.appBar} position="static">
          <AppToolbar {...props} />
        </AppBar>
        <ViewsContainer {...props} />
      </div>
      <AppFab session={session} />

      {drawerVisible && drawerPosition === 'right' ? (
        <LazyDrawerWidget session={session} />
      ) : null}

      <Snackbar session={session} />
    </div>
  )
})

export { App }
