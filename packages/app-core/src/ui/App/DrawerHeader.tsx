import { Suspense, lazy, useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import HelpOutline from '@mui/icons-material/HelpOutline'
import LaunchIcon from '@mui/icons-material/Launch'
import { AppBar, IconButton, Toolbar, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import DrawerControls from './DrawerControls'
import DrawerWidgetSelector from './DrawerWidgetSelector'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const SimpleHelpDialog = lazy(() => import('@jbrowse/core/ui/SimpleHelpDialog'))

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
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
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
          <Tooltip title="Help">
            <IconButton color="inherit" onClick={() => setHelpDialogOpen(true)}>
              <HelpOutline />
            </IconButton>
          </Tooltip>
        ) : null}
        <div className={classes.spacer} />
        <DrawerControls session={session} />
      </Toolbar>
      {helpDialogOpen ? (
        <Suspense fallback={null}>
          <CascadingMenuHelpDialog
            helpText={helpText}
            onClose={() => setHelpDialogOpen(false)}
          />
        </Suspense>
      ) : null}
    </AppBar>
  )
})

export default DrawerHeader
