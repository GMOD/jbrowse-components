import ErrorBar from '@jbrowse/core/ui/ErrorBar'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { ErrorBarProps } from '@jbrowse/display-ui'

const DisplayErrorBar = observer(function DisplayErrorBar({
  error,
  onRetry,
}: ErrorBarProps) {
  return onRetry ? (
    <ErrorBar error={error} onRetry={onRetry} />
  ) : (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <BlockMsg
        severity="info"
        message={error instanceof Error ? error.message : String(error)}
      />
    </div>
  )
})

export default DisplayErrorBar
