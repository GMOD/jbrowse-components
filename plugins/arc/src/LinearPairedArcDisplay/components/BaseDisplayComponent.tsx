import React, { lazy } from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// local
import type { LinearArcDisplayModel } from '../model'

// icons

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

const useStyles = makeStyles()(theme => ({
  loading: {
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${theme.palette.action.disabledBackground} 5px, ${theme.palette.action.disabledBackground} 10px)`,
    position: 'absolute',
    bottom: 0,
    height: 50,
    width: 300,
    right: 0,
    pointerEvents: 'none',
    textAlign: 'center',
  },
}))

const BaseDisplayComponent = observer(function ({
  model,
  children,
}: {
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <BlockMsg
      message={`${error}`}
      severity="error"
      action={
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
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <DataDisplay model={model}>{children}</DataDisplay>
  )
})

const DataDisplay = observer(function ({
  model,
  children,
}: {
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { loading } = model
  return (
    <div>
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function ({
  model,
}: {
  model: LinearArcDisplayModel
}) {
  const { classes } = useStyles()
  const { message } = model
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={message} />
    </div>
  )
})

export default BaseDisplayComponent
