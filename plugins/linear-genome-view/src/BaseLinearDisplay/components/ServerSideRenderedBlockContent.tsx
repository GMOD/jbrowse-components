import React, { lazy } from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

// icons
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { Tooltip, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import BlockMsg from './BlockMsg'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },
  }
})

const LoadingMessage = observer(({ model }: { model: { status?: string } }) => {
  const { classes } = useStyles()
  const { status: blockStatus } = model
  const { message: displayStatus } = getParent<{ message?: string }>(model, 2)
  const status = displayStatus || blockStatus
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={status} />
    </div>
  )
})

const ServerSideRenderedBlockContent = observer(function ({
  model,
}: {
  model: {
    error?: unknown
    reload: () => void
    message: React.ReactNode
    filled?: boolean
    status?: string
    reactElement?: React.ReactElement
  }
}) {
  if (model.error) {
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
                    { onClose, error: model.error as Error },
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
  } else if (model.message) {
    // the message can be a fully rendered react component, e.g. the region too large message
    return React.isValidElement(model.message) ? (
      model.message
    ) : (
      <BlockMsg message={`${model.message}`} severity="info" />
    )
  } else if (!model.filled) {
    return <LoadingMessage model={model} />
  } else {
    return model.reactElement
  }
})

export default ServerSideRenderedBlockContent
