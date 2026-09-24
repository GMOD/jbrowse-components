import { Suspense, useEffect } from 'react'

import Snackbar from '@jbrowse/core/ui/Snackbar'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  AppReadyMarker,
  ModalWidget,
  drawerGridTemplateColumns,
} from '@jbrowse/product-core'
import { AppBar, useMediaQuery, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import AppFab from './AppFab.tsx'
import AppToolbar from './AppToolbar.tsx'
import DialogQueue from './DialogQueue.tsx'
import ViewsContainer from './ViewsContainer.tsx'
import { DrawerWidget } from './lazyParts.ts'

import type { AppSession } from './types.ts'

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
    // an implicit column floors at the toolbar's min-content, which widened
    // the page past a phone's screen rather than ellipsizing the session name
    gridTemplateColumns: 'minmax(0, 1fr)',
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
  const { drawerVisible, drawerWidth, drawerPosition, modalWidgetVisible } =
    session
  // a phone has no room for a drawer column beside the views
  const narrow = useMediaQuery(useTheme().breakpoints.down('sm'), {
    noSsr: true,
  })
  useEffect(() => {
    session.setModalWidgets(narrow)
  }, [session, narrow])
  const gridTemplateColumns = drawerGridTemplateColumns({
    drawerVisible,
    drawerPosition,
    drawerWidth,
  })

  return (
    <div className={classes.root} style={{ gridTemplateColumns }}>
      {modalWidgetVisible ? (
        <ModalWidget
          session={session}
          fullScreen={narrow}
          onClose={() => {
            session.closeModalWidget()
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
        <ViewsContainer session={session} />
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
