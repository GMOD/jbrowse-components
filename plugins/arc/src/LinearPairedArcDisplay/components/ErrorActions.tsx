import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'

import type { LinearArcDisplayModel } from '../model'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

export default function ErrorActions({
  model,
}: {
  model: LinearArcDisplayModel
}) {
  return (
    <>
      <Tooltip title="Reload">
        <IconButton
          data-testid="reload_button"
          onClick={() => {
            model.reload()
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Show stack trace">
        <IconButton
          onClick={() => {
            getSession(model).queueDialog(onClose => [
              ErrorMessageStackTraceDialog,
              {
                onClose,
                error: model.error as Error,
              },
            ])
          }}
        >
          <ReportIcon />
        </IconButton>
      </Tooltip>
    </>
  )
}
