import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearArcDisplayModel } from '../model'
import LoadingBar from './LoadingBar'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

function ErrorActions({ model }: { model: LinearArcDisplayModel }) {
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
      action={<ErrorActions model={model} />}
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

export default BaseDisplayComponent
