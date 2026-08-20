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
 * `onStop` is optional: the manual tab's fetch runs on `useFetch`, whose token
 * is tied to the key and the mount, so the dialog's Cancel is its stop and a
 * second button would claim an affordance the hook doesn't expose. It still gets
 * the same label and bar.
 *
 * The bar holds at 0 rather than going indeterminate for the sub-second startup
 * before the first counts arrive. Every clustering phase reports counts, so a
 * sweep here says only "something is happening" during the one moment that is
 * never in doubt. The label leaves the percentage off until there is a real one.
 *
 * The cost is that a determinate 0 announces "0 percent" for that moment where
 * an indeterminate bar would announce nothing. Revisit if the startup ever stops
 * being sub-second.
 */
export default function ClusterProgress({
  status,
  label,
  onStop,
}: {
  status?: RpcStatus
  /** shown until the fetcher reports a phase of its own */
  label?: string
  onStop?: () => void
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
          {progressLabel(statusMessageText(status), fraction) ||
            label ||
            'Loading...'}
        </span>
        {onStop ? (
          <Button variant="contained" color="primary" onClick={onStop}>
            Stop
          </Button>
        ) : null}
      </div>
      <StatusProgressBar fraction={fraction ?? 0} />
    </div>
  )
}
