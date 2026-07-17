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
 * a Stop button pushed to the far right so it never crowds the text, and a
 * determinate bar underneath.
 *
 * The bar holds at 0 rather than going indeterminate for the sub-second
 * startup, before the first counts arrive: MUI animates an indeterminate bar by
 * sweeping it across the full width, which reads as ~100% and then appears to
 * drop backwards when the first real fraction (a few percent) lands. Every
 * clustering phase reports counts, so that sweep is noise. The label leaves the
 * percentage off until there's a real one.
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
        <Button variant="contained" color="primary" onClick={onStop}>
          Stop
        </Button>
      </div>
      <StatusProgressBar fraction={fraction ?? 0} />
    </div>
  )
}
