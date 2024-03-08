import React, { Suspense, lazy, useState } from 'react'
import { Button, IconButton } from '@mui/material'

// locals
import RedErrorMessageBox from './RedErrorMessageBox'

// icons
import { Refresh } from '@mui/icons-material'

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
    const match = trim.match(
      /.*at path "(.*)" snapshot `(.*)` is not assignable/m,
    )
    if (match) {
      str = `Failed to load element at ${match[1]}...Failed element had snapshot`
      snapshotError = match[2]
    }

    // case 2. element has no path
    const match2 = trim.match(/.*snapshot `(.*)` is not assignable/)
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
  onReset: () => void
}) => {
  const str = `${error}`
  const snapshotError = parseError(str)
  const [showStack, setShowStack] = useState(false)
  return (
    <RedErrorMessageBox>
      {str.slice(0, 10000)}

      {typeof error === 'object' && error && 'stack' in error ? (
        <Button
          style={{ float: 'right' }}
          variant="contained"
          onClick={() => setShowStack(!showStack)}
        >
          {showStack ? 'Hide stack trace' : 'Show stack trace'}
        </Button>
      ) : null}
      {onReset ? (
        <IconButton onClick={onReset}>
          <Refresh />
        </IconButton>
      ) : null}
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
