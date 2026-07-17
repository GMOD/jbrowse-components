import { StatusProgressBar } from '@jbrowse/core/ui'
import {
  progressLabel,
  statusFraction,
  statusMessageText,
} from '@jbrowse/core/util'
import { Button } from '@mui/material'

import type { RpcStatus } from '@jbrowse/core/util'

/**
 * The in-progress row of the cluster dialog: the current phase and percentage,
 * a Stop button pushed to the far right so it never crowds the text, and a bar
 * that runs determinate once clustering reports counts (indeterminate during
 * the init phase, which has no denominator).
 */
export default function ClusterProgress({
  status,
  onStop,
}: {
  status: RpcStatus
  onStop: () => void
}) {
  const fraction = statusFraction(status)
  return (
    <div style={{ padding: '24px 8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 8,
        }}
      >
        <span style={{ flex: 1 }}>
          {progressLabel(statusMessageText(status), fraction) || 'Loading...'}
        </span>
        <Button variant="outlined" color="secondary" onClick={onStop}>
          Stop
        </Button>
      </div>
      <StatusProgressBar fraction={fraction} />
    </div>
  )
}
