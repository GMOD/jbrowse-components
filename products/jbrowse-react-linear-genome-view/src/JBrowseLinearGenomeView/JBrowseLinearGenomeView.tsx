import { Suspense } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { StyleThemeProvider } from '@jbrowse/core/ui/PaletteContext'
import Snackbar from '@jbrowse/core/ui/Snackbar'
import { getEnv } from '@jbrowse/core/util'
import { useScrollPortHeightVar } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { EmbeddedViewContainer } from '@jbrowse/embedded-core'
import {
  AppReadyMarker,
  DrawerWidget,
  drawerGridTemplateColumns,
} from '@jbrowse/product-core'
import { ScopedCssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import EmbeddedAppBar from './EmbeddedAppBar.tsx'

import type { ViewModel } from '../createModel/createModel.ts'

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
  // `minmax(0, 1fr)`, not `1fr`, so the bounded row can shrink below its
  // content and the box inside it scrolls. The bar's row exists only with the
  // bar: an empty declared row is one auto-placement fills with the view box
  // and the drawer instead.
  const style = {
    gridTemplateColumns,
    gridTemplateRows: menuBarVisible ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
    height,
  }

  return (
    <ThemeProvider theme={theme}>
      <StyleThemeProvider theme={styleTheme}>
        <div className={classes.avoidParentStyle}>
          <ScopedCssBaseline>
            <div className={classes.root} style={style}>
              <EmbeddedAppBar viewState={viewState} />
              {/* a bounded root can be shorter than the track set; the LGV
                  owns horizontal scrolling */}
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
              {/* `gridTemplateColumns` places it on the `drawerPosition` side */}
              {drawerVisible ? <DrawerWidget session={session} /> : null}
            </div>
            {/* the only reader of `session.snackbarMessages`, where an
                unresolvable track id or locstring reports itself */}
            <Snackbar session={session} />
            <AppReadyMarker session={session} />
          </ScopedCssBaseline>
        </div>
      </StyleThemeProvider>
    </ThemeProvider>
  )
})

export default JBrowseLinearGenomeView
