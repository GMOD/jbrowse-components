import { lazy } from 'react'

import HelpOutline from '@mui/icons-material/HelpOutline'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerHeaderHelpDialog = lazy(() => import('./DrawerHeaderHelpDialog'))

const DrawerHeaderHelpButton = observer(function DrawerHeaderHelpButton({
  session,
  helpText,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
  helpText: React.ReactNode
}) {
  return (
    <Tooltip title="Help">
      <IconButton
        color="inherit"
        onClick={() => {
          session.queueDialog(handleClose => [
            DrawerHeaderHelpDialog,
            {
              onClose: handleClose,
              helpText,
            },
          ])
        }}
      >
        <HelpOutline />
      </IconButton>
    </Tooltip>
  )
})

export default DrawerHeaderHelpButton
