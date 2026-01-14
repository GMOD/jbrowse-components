import ErrorMessageStackTraceDialog from '@jbrowse/core/ui/ErrorMessageStackTraceDialog'
import { getSession } from '@jbrowse/core/util'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

const BlockErrorMessage = observer(function BlockErrorMessage({
  model,
}: {
  model: {
    error?: unknown
    reload: () => void
  }
}) {
  return (
    <BlockMsg
      message={`${model.error}`}
      severity="error"
      action={
        <>
          <Tooltip title="Reload track">
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
      }
    />
  )
})

export default BlockErrorMessage
