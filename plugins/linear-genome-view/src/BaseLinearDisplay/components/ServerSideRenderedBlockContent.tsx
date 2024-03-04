import React, { lazy } from 'react'
import { Tooltip, IconButton } from '@mui/material'

import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getParent } from 'mobx-state-tree'
import { LoadingEllipses } from '@jbrowse/core/ui'

// icons
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'

// locals
import BlockMsg from './BlockMsg'
import { getSession } from '@jbrowse/core/util'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LoadingMessage = observer(({ model }: { model: any }) => {
  const { classes } = useStyles()
  const { status: blockStatus } = model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { message: displayStatus } = getParent<any>(model, 2)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
}) {
  if (model.error) {
    return (
      <BlockMsg
        message={`${model.error}`}
        severity="error"
        action={
          <>
            <Tooltip title="Reload">
              <IconButton
                data-testid="reload_button"
                onClick={() => model.reload()}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Show stack trace">
              <IconButton
                onClick={() => {
                  getSession(model).queueDialog(onClose => [
                    ErrorMessageStackTraceDialog,
                    { onClose, error: model.error },
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
