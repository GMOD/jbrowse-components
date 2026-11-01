import { Suspense, lazy } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DrawerHeader as DrawerHeaderShell } from '@jbrowse/product-core'
import LaunchIcon from '@mui/icons-material/Launch'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerHeaderHelpButton = lazy(
  () => import('./DrawerHeaderHelpButton.tsx'),
)

const useStyles = makeStyles()(theme => ({
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
  const { focusedViewId, visibleWidget } = session
  const viewWidgetId = visibleWidget?.view?.id
  const helpText = visibleWidget
    ? getEnv(session).pluginManager.getWidgetType(visibleWidget.type).helpText
    : undefined

  return (
    <DrawerHeaderShell
      session={session}
      setToolbarHeight={setToolbarHeight}
      className={
        viewWidgetId !== undefined && focusedViewId === viewWidgetId
          ? undefined
          : classes.headerUnfocused
      }
    >
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
    </DrawerHeaderShell>
  )
})

export default DrawerHeader
