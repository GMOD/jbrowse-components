import { Suspense, lazy, useState } from 'react'

import ReportIcon from '@mui/icons-material/Report'
import { IconButton, Tooltip } from '@mui/material'

import type { IconButtonProps } from '@mui/material'

const ErrorMessageStackTraceDialog = lazy(
  () => import('./ErrorMessageStackTraceDialog.tsx'),
)

// "Show stack trace" icon button that lazy-loads and opens the stack-trace
// dialog. Shared by ErrorBanner and ErrorBar so the lazy import and open/close
// state live in one place.
export default function StackTraceButton({
  error,
  color,
}: {
  error: unknown
  color?: IconButtonProps['color']
}) {
  const [showStack, setShowStack] = useState(false)
  return (
    <>
      <Tooltip title="Show stack trace">
        <IconButton
          color={color}
          onClick={() => {
            setShowStack(true)
          }}
        >
          <ReportIcon />
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
  )
}
