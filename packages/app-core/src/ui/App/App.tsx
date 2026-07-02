import { Suspense, lazy } from 'react'

import Snackbar from '@jbrowse/core/ui/Snackbar'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { drawerGridTemplateColumns } from '@jbrowse/product-core'
import { AppBar } from '@mui/material'
import { observer } from 'mobx-react'

import AppFab from './AppFab.tsx'
import AppToolbar from './AppToolbar.tsx'
import DialogQueue from './DialogQueue.tsx'
import ViewsContainer from './ViewsContainer.tsx'

import type { AppSession } from './types.ts'

// lazies
const DrawerWidget = lazy(() => import('./DrawerWidget.tsx'))

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
  session: AppSession
}

const App = observer(function App(props: Props) {
  const { session } = props
  const { classes } = useStyles()
  const { minimized, visibleWidget, drawerWidth, drawerPosition } = session
  const drawerVisible = Boolean(visibleWidget) && !minimized
  const gridTemplateColumns = drawerGridTemplateColumns({
    drawerVisible,
    drawerPosition,
    drawerWidth,
  })

  // one element placed into either the left or right grid column by DOM order
  // (the drawer isn't self-positioning, so it must be rendered on the matching
  // side of the app container)
  const drawerWidget = drawerVisible ? (
    <Suspense fallback={null}>
      <DrawerWidget session={session} />
    </Suspense>
  ) : null

  return (
    <div className={classes.root} style={{ gridTemplateColumns }}>
      {drawerPosition === 'left' ? drawerWidget : null}
      <DialogQueue session={session} />
      <div className={classes.appContainer}>
        <AppBar className={classes.appBar} position="static">
          <AppToolbar {...props} />
        </AppBar>
        <ViewsContainer {...props} />
      </div>
      <AppFab session={session} />
      {drawerPosition === 'right' ? drawerWidget : null}
      <Snackbar session={session} />
    </div>
  )
})

export { App }
