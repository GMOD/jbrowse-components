import { Suspense, lazy, useState } from 'react'

import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { Alert, IconButton, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog.tsx'),
)

const useStyles = makeStyles()({
  content: {
    wordBreak: 'break-word',
    textAlign: 'center',
  },
})

export default function ErrorBar({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const { classes } = useStyles()
  const [showStack, setShowStack] = useState(false)
  const message = `${error}`
  return (
    <div
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <Alert
        severity="error"
        action={
          <>
            <Tooltip title="Show stack trace">
              <IconButton
                onClick={() => {
                  setShowStack(true)
                }}
              >
                <ReportIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Retry">
              <IconButton data-testid="reload_button" onClick={onRetry}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {showStack ? (
              <Suspense fallback={null}>
                <ErrorMessageStackTraceDialog
                  error={error}
                  onClose={() => {
                    setShowStack(false)
                  }}
                />
              </Suspense>
            ) : null}
          </>
        }
      >
        <Tooltip title={message}>
          <div className={classes.content}>{message}</div>
        </Tooltip>
      </Alert>
    </div>
  )
}
