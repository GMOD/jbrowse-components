import React, { Suspense, lazy, useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'

// locals
import RedErrorMessageBox from './RedErrorMessageBox'

// icons
import RefreshIcon from '@mui/icons-material/Refresh'
import ReportIcon from '@mui/icons-material/Report'

// lazies
const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog'),
)

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
      snapshotError = match[2]
    }

    // case 2. element has no path
    const match2 = /.*snapshot `(.*)` is not assignable/.exec(trim)
    if (match2) {
      str = `Failed to load element...Failed element had snapshot`
      snapshotError = match2[1]
    }
  }
  return snapshotError
}

const ErrorMessage = ({
  error,
  onReset,
}: {
  error: unknown
  onReset?: () => void
}) => {
  const str = `${error}`
  const str2 = str.indexOf('expected an instance of')
  const str3 = str2 !== -1 ? str.slice(0, str2) : str
  const snapshotError = parseError(str)
  const [showStack, setShowStack] = useState(false)
  return (
    <RedErrorMessageBox>
      {str3.slice(0, 10000)}

      <div style={{ float: 'right', marginLeft: 100 }}>
        {typeof error === 'object' && error && 'stack' in error ? (
          <Tooltip title="Get stack trace">
            <IconButton onClick={() => setShowStack(true)} color="primary">
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
      </div>
      {snapshotError ? (
        <pre
          style={{
            background: 'lightgrey',
            border: '1px solid black',
            margin: 20,
          }}
        >
          {JSON.stringify(JSON.parse(snapshotError), null, 2)}
        </pre>
      ) : null}
      {showStack ? (
        <Suspense fallback={null}>
          <ErrorMessageStackTraceDialog
            error={error}
            onClose={() => setShowStack(false)}
          />
        </Suspense>
      ) : null}
    </RedErrorMessageBox>
  )
}

export default ErrorMessage
