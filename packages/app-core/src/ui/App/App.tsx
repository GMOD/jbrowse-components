import { Suspense, lazy } from 'react'

import Snackbar from '@jbrowse/core/ui/Snackbar'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ModalWidget, drawerGridTemplateColumns } from '@jbrowse/product-core'
import { AppBar } from '@mui/material'
import { observer } from 'mobx-react'

import AppFab from './AppFab.tsx'
import AppReadyMarker from './AppReadyMarker.tsx'
import AppToolbar from './AppToolbar.tsx'
import DialogQueue from './DialogQueue.tsx'
import ViewsContainer from './ViewsContainer.tsx'
import { lazyChunk } from './lazyChunk.ts'

import type { AppSession } from './types.ts'

// lazies
const DrawerWidget = lazy(
  lazyChunk('DrawerWidget', () => import('./DrawerWidget.tsx')),
)

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'grid',
    // Embedders can fit the app to its container by setting the
    // --jbrowse-app-height CSS variable (e.g. to 100%); it defaults to the
    // full viewport for standalone/full-window use.
    height: 'var(--jbrowse-app-height, 100vh)',
    // the containing block for AppFab, which floats over the app rather than
    // over the page
    position: 'relative',
    // pin the single implicit row to the container height so appContainer
    // fills it (an auto row would instead grow to content and overflow)
    gridTemplateRows: 'minmax(0, 1fr)',
    width: '100%',
    colorScheme: theme.palette.mode,
  },
  appContainer: {
    gridColumn: 'main',
    display: 'grid',
    gridTemplateRows: '[menubar] min-content [components] minmax(0, 1fr)',
    height: '100%',
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
  const { drawerVisible, drawerWidth, drawerPosition, poppedOut } = session
  const gridTemplateColumns = drawerGridTemplateColumns({
    drawerVisible,
    drawerPosition,
    drawerWidth,
  })

  return (
    <div className={classes.root} style={{ gridTemplateColumns }}>
      {poppedOut ? (
        <ModalWidget
          session={session}
          onClose={() => {
            session.returnWidgetToDrawer()
          }}
        />
      ) : null}
      <DialogQueue session={session} />
      <div className={classes.appContainer}>
        {/* the testid is what a figure's stage title anchors to: it is the one
            element whose rect is the top-left of the whole frame, so a caption
            that belongs to the picture rather than to any track has something
            to hang off other than a measured pixel */}
        <AppBar
          className={classes.appBar}
          position="static"
          data-testid="app-bar"
        >
          <AppToolbar {...props} />
        </AppBar>
        <ViewsContainer {...props} />
      </div>
      <AppFab session={session} />
      <AppReadyMarker session={session} />
      {/* takes the `[drawer]` column `gridTemplateColumns` puts on the side
          `drawerPosition` names, so it is rendered once and its place in this
          list means nothing */}
      {drawerVisible ? (
        <Suspense fallback={null}>
          <DrawerWidget session={session} />
        </Suspense>
      ) : null}
      <Snackbar session={session} />
    </div>
  )
})

export { App }
