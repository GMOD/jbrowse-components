import { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
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
  headerButtons,
}: {
  viewState: ViewModel
  /**
   * Your own controls, rendered in the app's toolbar next to the session name.
   * This is where a Share button goes: only the host knows the URL its page is
   * served at and whether that page restores a session, so the button that
   * builds a link has to be yours — see `encodeSession`/`decodeSession` and the
   * session-in-url example. jbrowse-web fills the same slot with its own
   * ShareButton.
   */
  headerButtons?: React.ReactElement
}) {
  const { classes } = useStyles()
  const { session } = viewState

  return (
    <ThemeProvider theme={session.theme}>
      <PaletteProvider palette={session.palette}>
        <div className={classes.avoidParentStyle}>
          <ScopedCssBaseline sx={{ height: '100%' }}>
            <Suspense fallback={<LoadingEllipses />}>
              {/* key forces React to remount App when the session is replaced
                (File > New session, File > Import session, setSession from a
                host) preventing stale references to old session views */}
              <App
                key={session.id}
                session={session}
                HeaderButtons={headerButtons}
              />
            </Suspense>
          </ScopedCssBaseline>
        </div>
      </PaletteProvider>
    </ThemeProvider>
  )
})

export default JBrowseApp
