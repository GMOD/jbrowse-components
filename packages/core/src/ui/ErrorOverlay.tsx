import ErrorBar from './ErrorBar.tsx'

import type { ReactNode } from 'react'

export default function ErrorOverlay({
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
}
