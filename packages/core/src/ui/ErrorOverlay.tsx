import { observer } from 'mobx-react'

import ErrorBar from './ErrorBar.tsx'

import type { ReactNode } from 'react'

const ErrorOverlay = observer(function ErrorOverlay({
  error,
  onRetry,
  width,
  height,
  extraAction,
}: {
  error: unknown
  onRetry: () => void
  width: number | string
  height: number | string
  extraAction?: ReactNode
}) {
  return (
    <div style={{ position: 'relative', width, height }}>
      <ErrorBar error={error} onRetry={onRetry} extraAction={extraAction} />
    </div>
  )
})

export default ErrorOverlay
