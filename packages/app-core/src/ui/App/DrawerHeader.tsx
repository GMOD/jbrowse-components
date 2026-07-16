import { Suspense, lazy, useCallback } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import LaunchIcon from '@mui/icons-material/Launch'
import { AppBar, IconButton, Toolbar, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import DrawerControls from './DrawerControls.tsx'
import DrawerWidgetSelector from './DrawerWidgetSelector.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerHeaderHelpButton = lazy(
  () => import('./DrawerHeaderHelpButton.tsx'),
)

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

const DrawerHeader = observer(function DrawerHeader({
  session,
  setToolbarHeight,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
  setToolbarHeight: (arg: number) => void
}) {
  const { classes } = useStyles()
  const focusedViewId = session.focusedViewId
  const { visibleWidget } = session
  const viewWidgetId = visibleWidget?.view?.id
  const { pluginManager } = getEnv(session)
  const widgetType = visibleWidget
    ? pluginManager.getWidgetType(visibleWidget.type)
    : undefined
  const { helpText } = widgetType ?? {}

  const appBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      setToolbarHeight(ref?.getBoundingClientRect().height ?? 0)
    },
    [setToolbarHeight],
  )

  return (
    <AppBar
      position="sticky"
      className={
        focusedViewId === viewWidgetId
          ? classes.headerFocused
          : classes.headerUnfocused
      }
      ref={appBarRef}
    >
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
        <Tooltip title="Open drawer in dialog">
          <IconButton
            color="inherit"
            data-testid="drawer-popout"
            onClick={() => {
              session.popoutWidget()
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
