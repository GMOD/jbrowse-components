import { Suspense, lazy, useState } from 'react'

import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'

import RedErrorMessageBox from './RedErrorMessageBox.tsx'
import { makeStyles } from '../util/tss-react/index.ts'

// lazies
const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog.tsx'),
)

const useStyles = makeStyles()(theme => ({
  bg: {
    background: theme.palette.divider,
    border: '1px solid black',
    margin: 20,
  },
  message: {
    background: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    padding: '12px 16px',
    margin: '16px 20px',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
  },
  iconFloat: {
    float: 'right',
    marginLeft: 100,
  },
}))

function parseError(str: string) {
  let snapshotError = ''
  let message = ''
  const findStr = 'is not assignable'
  const idx = str.indexOf(findStr)
  if (idx !== -1) {
    const trim = str.slice(0, idx + findStr.length)
    // best effort to make a better error message than the default
    // @jbrowse/mobx-state-tree

    // case 1. element has a path
    const match = /.*at path "(.*)" snapshot `(.*)` is not assignable/m.exec(
      trim,
    )
    if (match) {
      snapshotError = match[2]!
      message = `Failed to load element at ${match[1]}...Failed element had snapshot`
    }

    // case 2. element has no path
    const match2 = /.*snapshot `(.*)` is not assignable/.exec(trim)
    if (match2) {
      snapshotError = match2[1]!
      message = 'Failed to load element...Failed element had snapshot'
    }
  }
  return { snapshotError, message }
}

function ErrorButtons({
  error,
  onReset,
}: {
  error: unknown
  onReset?: () => void
}) {
  const { classes } = useStyles()
  const [showStack, setShowStack] = useState(false)
  return (
    <div className={classes.iconFloat}>
      {typeof error === 'object' && error && 'stack' in error ? (
        <Tooltip title="Get stack trace">
          <IconButton
            onClick={() => {
              setShowStack(true)
            }}
            color="primary"
          >
            <ReportIcon />
          </IconButton>
        </Tooltip>
      ) : null}
      {onReset ? (
        <Tooltip title="Retry">
          <IconButton onClick={onReset} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      ) : null}
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
    </div>
  )
}

function ErrorMessage({
  error,
  onReset,
}: {
  error: unknown
  onReset?: () => void
}) {
  const { classes } = useStyles()
  const str = `${error}`
  const str2 = str.indexOf('expected an instance of')
  const str3 = str2 !== -1 ? str.slice(0, str2) : str
  const { snapshotError, message } = parseError(str)
  return (
    <RedErrorMessageBox>
      {str3.slice(0, 10000)}
      <ErrorButtons error={error} onReset={onReset} />
      {message ? <div className={classes.message}>{message}</div> : null}
      {snapshotError ? (
        <pre className={classes.bg}>
          {JSON.stringify(JSON.parse(snapshotError), null, 2)}
        </pre>
      ) : null}
    </RedErrorMessageBox>
  )
}

export default ErrorMessage
