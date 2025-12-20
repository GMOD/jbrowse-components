import { Suspense, lazy } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import LaunchIcon from '@mui/icons-material/Launch'
import { AppBar, IconButton, Toolbar, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import DrawerControls from './DrawerControls'
import DrawerWidgetSelector from './DrawerWidgetSelector'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerHeaderHelpButton = lazy(() => import('./DrawerHeaderHelpButton'))

const useStyles = makeStyles()(theme => ({
  spacer: {
    flexGrow: 1,
  },
  headerFocused: {
    background: theme.palette.secondary.main,
  },
  headerUnfocused: {
    background: theme.palette.secondary.dark,
  },
}))

const DrawerHeader = observer(function ({
  session,
  setToolbarHeight,
  onPopoutDrawer,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
  setToolbarHeight: (arg: number) => void
  onPopoutDrawer: () => void
}) {
  const { classes } = useStyles()
  const focusedViewId = session.focusedViewId
  const { visibleWidget } = session
  // @ts-expect-error
  const viewWidgetId = visibleWidget?.view?.id
  const { pluginManager } = getEnv(session)
  const widgetType = visibleWidget
    ? pluginManager.getWidgetType(visibleWidget.type)
    : undefined
  const { helpText } = widgetType || {}

  return (
    <AppBar
      position="sticky"
      className={
        focusedViewId === viewWidgetId
          ? classes.headerFocused
          : classes.headerUnfocused
      }
      ref={ref => {
        setToolbarHeight(ref?.getBoundingClientRect().height || 0)
      }}
    >
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
        <Tooltip title="Open drawer in dialog">
          <IconButton
            color="inherit"
            onClick={() => {
              onPopoutDrawer()
            }}
          >
            <LaunchIcon />
          </IconButton>
        </Tooltip>
        {helpText ? (
          <Suspense fallback={null}>
            <DrawerHeaderHelpButton helpText={helpText} session={session} />
          </Suspense>
        ) : null}
        <div className={classes.spacer} />
        <DrawerControls session={session} />
      </Toolbar>
    </AppBar>
  )
})

export default DrawerHeader
