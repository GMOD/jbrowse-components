import { Suspense, useState } from 'react'

import {
  ErrorBanner,
  LoadingEllipses,
  PluggableComponent,
} from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import DrawerHeader from './DrawerHeader.tsx'

import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  paper: {
    overflowY: 'auto',
    height: '100%',
    position: 'relative',
    zIndex: theme.zIndex.drawer,
    outline: 'none',
    background: theme.palette.background.default,
  },
  resizeHandle: {
    width: 4,
    position: 'fixed',
    top: 0,
    zIndex: theme.zIndex.drawer + 1,
  },
}))

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { visibleWidget, drawerPosition, drawerWidth } = session
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  if (!visibleWidget) {
    return null
  }

  const { ReactComponent } = pluginManager.getWidgetType(visibleWidget.type)

  return (
    <Paper className={classes.paper} elevation={16} square>
      <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
      <Suspense fallback={<LoadingEllipses />}>
        <ErrorBoundary
          FallbackComponent={({ error }) => <ErrorBanner error={error} />}
        >
          <PluggableComponent
            pluginManager={pluginManager}
            name="Core-replaceWidget"
            component={ReactComponent}
            props={{
              model: visibleWidget,
              session,
              toolbarHeight,
            }}
          />
        </ErrorBoundary>
      </Suspense>
      <ResizeHandle
        onDrag={distance => session.resizeDrawer(distance)}
        className={classes.resizeHandle}
        style={drawerPosition === 'left' ? { left: drawerWidth } : undefined}
        vertical
      />
    </Paper>
  )
})

export default DrawerWidget
