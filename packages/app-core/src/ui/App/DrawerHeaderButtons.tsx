import { Suspense, lazy } from 'react'

import { getEnv } from '@jbrowse/core/util'
import LaunchIcon from '@mui/icons-material/Launch'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerHeaderHelpButton = lazy(
  () => import('./DrawerHeaderHelpButton.tsx'),
)

const DrawerHeaderButtons = observer(function DrawerHeaderButtons({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { visibleWidget } = session
  const helpText = visibleWidget
    ? getEnv(session).pluginManager.getWidgetType(visibleWidget.type).helpText
    : undefined

  return (
    <>
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
    </>
  )
})

export default DrawerHeaderButtons
