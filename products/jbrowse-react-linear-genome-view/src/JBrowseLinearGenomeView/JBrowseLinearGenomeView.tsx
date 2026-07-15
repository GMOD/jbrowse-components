import { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
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
  const { view, theme } = session
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

  // The view is normally content-height so it can be embedded in a page that
  // grows with it. Only when a drawer opens do we clamp to drawerViewHeight
  // (default 100vh), giving the drawer's `overflowY: auto` a definite height to
  // scroll within.
  const style = drawerVisible
    ? { gridTemplateColumns, height: viewState.drawerViewHeight }
    : { gridTemplateColumns }

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.avoidParentStyle}>
        <ScopedCssBaseline>
          <div className={classes.root} style={style}>
            {drawerPosition === 'left' && drawerVisible ? (
              <Suspense fallback={null}>
                <DrawerWidget session={session} />
              </Suspense>
            ) : null}
            <div className={classes.container}>
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
        </ScopedCssBaseline>
      </div>
    </ThemeProvider>
  )
})

export default JBrowseLinearGenomeView
