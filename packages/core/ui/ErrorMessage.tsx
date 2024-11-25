import React, { Suspense, lazy, useState } from 'react'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import RedErrorMessageBox from './RedErrorMessageBox'

// icons

// lazies
const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog'),
)

const useStyles = makeStyles()(theme => ({
  bg: {
    background: theme.palette.divider,
    border: '1px solid black',
    margin: 20,
  },
  iconFloat: {
    float: 'right',
    marginLeft: 100,
  },
}))

function parseError(str: string) {
  let snapshotError = ''
  const findStr = 'is not assignable'
  const idx = str.indexOf(findStr)
  if (idx !== -1) {
    const trim = str.slice(0, idx + findStr.length)
    // best effort to make a better error message than the default
    // mobx-state-tree

    // case 1. element has a path
    const match = /.*at path "(.*)" snapshot `(.*)` is not assignable/m.exec(
      trim,
    )
    if (match) {
      str = `Failed to load element at ${match[1]}...Failed element had snapshot`
      snapshotError = match[2]!
    }

    // case 2. element has no path
    const match2 = /.*snapshot `(.*)` is not assignable/.exec(trim)
    if (match2) {
      str = 'Failed to load element...Failed element had snapshot'
      snapshotError = match2[1]!
    }
  }
  return snapshotError
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
  const snapshotError = parseError(str)
  return (
    <RedErrorMessageBox>
      {str3.slice(0, 10000)}
      <ErrorButtons error={error} onReset={onReset} />
      {snapshotError ? (
        <pre className={classes.bg}>
          {JSON.stringify(JSON.parse(snapshotError), null, 2)}
        </pre>
      ) : null}
    </RedErrorMessageBox>
  )
}

export default ErrorMessage
