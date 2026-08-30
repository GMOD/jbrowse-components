import { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { StyleThemeProvider } from '@jbrowse/core/ui/PaletteContext'
import Snackbar from '@jbrowse/core/ui/Snackbar'
import { getEnv } from '@jbrowse/core/util'
import { useScrollPortHeightVar } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { EmbeddedViewContainer } from '@jbrowse/embedded-core'
import { drawerGridTemplateColumns } from '@jbrowse/product-core'
import { ScopedCssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import EmbeddedAppBar from './EmbeddedAppBar.tsx'

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

  const { drawerPosition, drawerWidth, drawerVisible } = session
  const gridTemplateColumns = drawerGridTemplateColumns({
    drawerVisible,
    drawerPosition,
    drawerWidth,
  })

  const { effectiveHeight: height } = viewState
  const menuBarVisible = viewState.menus().length > 0
  const scrollPortRef = useScrollPortHeightVar()
  // The menu bar takes a row of its own, spanning the drawer's column as well
  // as the view's, and `minmax(0, 1fr)` gives the row below it a definite size
  // that can shrink -- a bare `1fr` floors at the content and the box it holds
  // stops being the thing that scrolls.
  //
  // The bar's row exists only when the bar does. Declared unconditionally, an
  // empty first row is what auto-placement fills instead: the view box and the
  // drawer land in the `auto` row, which is content-height, so a view with no
  // tracks clamps the drawer beside it to a couple of hundred pixels and leaves
  // the bounded row below them empty.
  const style = {
    gridTemplateColumns,
    gridTemplateRows: menuBarVisible ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
    ...(height ? { height } : {}),
  }

  return (
    <ThemeProvider theme={theme}>
      <StyleThemeProvider theme={styleTheme}>
        <div className={classes.avoidParentStyle}>
          <ScopedCssBaseline>
            <div className={classes.root} style={style}>
              <EmbeddedAppBar viewState={viewState} />
              {/* A bounded root can be shorter than the track set, and this box
                  is `overflow: hidden` with no scrollable ancestor -- nothing
                  above it was asked for a height -- so without a scrollbar of
                  its own everything below the fold is unreachable. Only the
                  vertical axis: the LGV owns horizontal scrolling. Unbounded,
                  there is nothing to overflow and the host's box scrolls. */}
              <div
                ref={scrollPortRef}
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
              {/* takes the `[drawer]` column `gridTemplateColumns` puts on the
                  side `drawerPosition` names, so its place in this list means
                  nothing */}
              {drawerVisible ? (
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
