import { Suspense } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { StyleThemeProvider } from '@jbrowse/core/ui/PaletteContext'
import Snackbar from '@jbrowse/core/ui/Snackbar'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { EmbeddedViewContainer } from '@jbrowse/embedded-core'
import { ModalWidget } from '@jbrowse/product-core'
import { ScopedCssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel.ts'

const useStyles = makeStyles()({
  avoidParentStyle: {
    all: 'initial',
    display: 'block',
    width: '100%',
    height: '100%',
  },
})

const JBrowseCircularGenomeView = observer(function JBrowseCircularGenomeView({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { session } = viewState
  const { view, theme, styleTheme } = session
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)
  const { classes } = useStyles()

  return (
    <ThemeProvider theme={theme}>
      <StyleThemeProvider theme={styleTheme}>
        <div className={classes.avoidParentStyle}>
          <ScopedCssBaseline>
            <EmbeddedViewContainer key={`view-${view.id}`} view={view}>
              <Suspense fallback={<LoadingEllipses />}>
                <ReactComponent model={view} session={session} />
              </Suspense>
            </EmbeddedViewContainer>
            <ModalWidget
              session={session}
              onClose={() => {
                // the modal is this product's only widget surface, so closing it
                // dismisses the widget rather than returning it to a drawer
                session.hideAllWidgets()
              }}
            />
            {/* see JBrowseLinearGenomeView for why: `session.snackbarMessages`
                is where every path that has to keep going after a failure
                reports itself, and until 2026-08 only `app-core`'s App drew it,
                so this product dropped them all. Module scope is two `lazy()`
                calls, so it costs the eager bundle nothing. */}
            <Snackbar session={session} />
          </ScopedCssBaseline>
        </div>
      </StyleThemeProvider>
    </ThemeProvider>
  )
})

export default JBrowseCircularGenomeView
