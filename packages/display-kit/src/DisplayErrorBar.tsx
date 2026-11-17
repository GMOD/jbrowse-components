import ErrorBar from '@jbrowse/core/ui/ErrorBar'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { ErrorBarProps } from '@jbrowse/display-ui'

const DisplayErrorBar = observer(function DisplayErrorBar({
  error,
  onRetry,
  onEditTrack,
}: ErrorBarProps) {
  return onRetry ? (
    <ErrorBar
      error={error}
      onRetry={onRetry}
      extraAction={
        onEditTrack ? (
          <Button
            data-testid="edit_track_button"
            color="inherit"
            onClick={onEditTrack}
          >
            Edit track
          </Button>
        ) : undefined
      }
    />
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
