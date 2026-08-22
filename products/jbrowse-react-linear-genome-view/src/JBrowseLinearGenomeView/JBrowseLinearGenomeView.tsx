import { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { StyleThemeProvider } from '@jbrowse/core/ui/PaletteContext'
import Snackbar from '@jbrowse/core/ui/Snackbar'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { EmbeddedViewContainer } from '@jbrowse/embedded-core'
import { drawerGridTemplateColumns } from '@jbrowse/product-core'
import { ScopedCssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel.ts'

const DrawerWidget = lazy(() =>
  import('@jbrowse/product-core').then(m => ({
    default: m.DrawerWidget,
  })),
)

const useStyles = makeStyles()({
  avoidParentStyle: {
    all: 'initial',
    display: 'block',
    width: '100%',
    height: '100%',
  },
  root: {
    display: 'grid',
    height: '100%',
    width: '100%',
  },
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
})

const JBrowseLinearGenomeView = observer(function JBrowseLinearGenomeView({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { session } = viewState
  const { view, theme, styleTheme } = session
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)
  const { classes } = useStyles()

  const { drawerPosition, drawerWidth, minimized, visibleWidget } = session
  const drawerVisible = Boolean(visibleWidget) && !minimized
  const gridTemplateColumns = drawerGridTemplateColumns({
    drawerVisible,
    drawerPosition,
    drawerWidth,
  })

  const { effectiveHeight: height } = viewState
  const style = height
    ? { gridTemplateColumns, height }
    : { gridTemplateColumns }

  return (
    <ThemeProvider theme={theme}>
      <StyleThemeProvider theme={styleTheme}>
        <div className={classes.avoidParentStyle}>
          <ScopedCssBaseline>
            <div className={classes.root} style={style}>
              {drawerPosition === 'left' && drawerVisible ? (
                <Suspense fallback={null}>
                  <DrawerWidget session={session} />
                </Suspense>
              ) : null}
              {/* A bounded root can be shorter than the track set, and this box
                  is `overflow: hidden` with no scrollable ancestor -- nothing
                  above it was asked for a height -- so without a scrollbar of
                  its own everything below the fold is unreachable. Only the
                  vertical axis: the LGV owns horizontal scrolling. Unbounded,
                  there is nothing to overflow and the host's box scrolls. */}
              <div
                className={classes.container}
                style={height ? { overflowY: 'auto' } : undefined}
                data-testid="embedded-view-box"
              >
                <EmbeddedViewContainer key={`view-${view.id}`} view={view}>
                  <Suspense fallback={<LoadingEllipses />}>
                    <ReactComponent model={view} session={session} />
                  </Suspense>
                </EmbeddedViewContainer>
              </div>
              {drawerPosition === 'right' && drawerVisible ? (
                <Suspense fallback={null}>
                  <DrawerWidget session={session} />
                </Suspense>
              ) : null}
            </div>
            {/* Everything JBrowse has to survive rather than throw reports
                itself through `session.snackbarMessages` -- `showTrack` with an
                unresolvable id, a session track whose config won't validate, an
                `init.loc` that doesn't resolve. Those calls return `undefined`
                and carry on, so without this the message is the only record of
                what went wrong and nothing reads it: the embed shows a track
                that simply never appears. `app-core`'s App was the only thing in
                the repo rendering it until 2026-08.

                Costs the eager bundle nothing worth counting -- `Snackbar`'s
                module scope is two `lazy()` calls, so the toast and its
                stack-trace dialog arrive only if something is reported. */}
            <Snackbar session={session} />
          </ScopedCssBaseline>
        </div>
      </StyleThemeProvider>
    </ThemeProvider>
  )
})

export default JBrowseLinearGenomeView
