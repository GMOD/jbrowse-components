import { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ScopedCssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel.ts'

const App = lazy(() => import('./AppReExport.tsx'))

const useStyles = makeStyles()({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
    // all:initial resets display to inline; restore a block box that fills the
    // host so a percentage --jbrowse-app-height resolves down to the App root.
    // (all does not reset custom properties, so the variable still inherits.)
    display: 'block',
    height: '100%',
    width: '100%',
  },
})

const JBrowseApp = observer(function JBrowseApp({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { classes } = useStyles()
  const { session } = viewState

  return (
    <ThemeProvider theme={session.theme}>
      <div className={classes.avoidParentStyle}>
        <ScopedCssBaseline sx={{ height: '100%' }}>
          <Suspense fallback={<LoadingEllipses />}>
            {/* key forces React to remount App when session changes (e.g.
                duplicate session) preventing stale references to old session views */}
            <App key={session.id} session={session} />
          </Suspense>
        </ScopedCssBaseline>
      </div>
    </ThemeProvider>
  )
})

export default JBrowseApp
