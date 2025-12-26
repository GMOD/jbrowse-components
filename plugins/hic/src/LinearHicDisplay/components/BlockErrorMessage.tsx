import ErrorMessageStackTraceDialog from '@jbrowse/core/ui/ErrorMessageStackTraceDialog'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { Alert, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  ellipses: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  content: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    maxWidth: '80%',
    textAlign: 'center',
  },
})

const BlockErrorMessage = observer(function BlockErrorMessage({
  model,
}: {
  model: {
    error?: unknown
    reload: () => void
  }
}) {
  const { classes } = useStyles()
  return (
    <Alert
      severity="error"
      action={
        <>
          <Tooltip title="Reload track">
            <IconButton data-testid="reload_button" onClick={model.reload}>
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
      classes={{
        message: classes.ellipses,
      }}
      onMouseDown={event => {
        event.stopPropagation()
      }}
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <Tooltip title={`${model.error}`}>
        <div className={classes.content}>{`${model.error}`}</div>
      </Tooltip>
    </Alert>
  )
})

export default BlockErrorMessage
