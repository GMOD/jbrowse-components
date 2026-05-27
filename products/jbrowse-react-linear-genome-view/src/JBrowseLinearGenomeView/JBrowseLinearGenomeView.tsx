import { Suspense, lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { EmbeddedViewContainer, ModalWidget } from '@jbrowse/embedded-core'
import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel.ts'
import type { SessionWithDrawerWidgets } from '@jbrowse/product-core'

const DrawerWidget = lazy(() =>
  import('@jbrowse/product-core').then(m => ({
    default: m.DrawerWidget,
  })),
)

const useStyles = makeStyles()({
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
  const { view } = session
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)!
  const theme = createJBrowseTheme(
    readConfObject(viewState.config.configuration, 'theme'),
  )
  const { classes } = useStyles()

  const drawerSession = session as SessionWithDrawerWidgets
  const { drawerPosition, drawerWidth, minimized, visibleWidget } =
    drawerSession
  const drawerViewHeight = viewState.drawerViewHeight
  const drawerVisible = visibleWidget && !minimized

  const drawerCol = drawerVisible ? `${drawerWidth}px` : undefined
  const viewCol = '1fr'
  const gridColumns =
    drawerPosition === 'left'
      ? [drawerCol, viewCol].filter(Boolean).join(' ')
      : [viewCol, drawerCol].filter(Boolean).join(' ')

  return (
    <ThemeProvider theme={theme}>
      <div
        className={classes.root}
        style={
          visibleWidget
            ? { gridTemplateColumns: gridColumns, height: drawerViewHeight }
            : { gridTemplateColumns: gridColumns }
        }
      >
        {drawerPosition === 'left' && visibleWidget ? (
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
          {!visibleWidget ? <ModalWidget session={session} /> : null}
        </div>
        {drawerPosition === 'right' && visibleWidget ? (
          <Suspense fallback={null}>
            <DrawerWidget session={session} />
          </Suspense>
        ) : null}
      </div>
    </ThemeProvider>
  )
})

export default JBrowseLinearGenomeView
