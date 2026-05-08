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
  const drawerPosition = drawerSession.drawerPosition || 'right'
  const drawerWidth = drawerSession.drawerWidth || 384
  const minimized = drawerSession.minimized || false
  const visibleWidget = drawerSession.visibleWidget

  const gridColumns =
    drawerPosition === 'left'
      ? minimized
        ? `0px 1fr`
        : `${drawerWidth}px 1fr`
      : minimized
        ? `1fr 0px`
        : `1fr ${drawerWidth}px`

  return (
    <ThemeProvider theme={theme}>
      <div
        className={classes.root}
        style={{ gridTemplateColumns: gridColumns }}
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
          <ModalWidget session={session} />
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
