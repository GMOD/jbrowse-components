import { observer } from 'mobx-react'

import { keyframes, makeStyles } from '../util/tss-react/index.ts'
import LoadingProgress from './LoadingProgress.tsx'

// anti-flash: hold the chip hidden for the first moments so a fast job (which
// unmounts the chip before the delay elapses) never flashes. The chip remounts
// per job, so the delay restarts each time. 0s duration = no fade, it just
// appears after the delay.
const appear = keyframes`
  from { opacity: 0; }
  to { opacity: 0.8; }
`

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    zIndex: 2,
    pointerEvents: 'none',
    padding: '0 4px',
    borderRadius: 4,
    background: theme.palette.background.paper,
    opacity: 0.8,
    animation: `${appear} 0s linear 0.25s both`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  bar: {
    width: 120,
  },
}))

/**
 * Bottom-right progress chip for work running while usable content is already on
 * screen: a refetch over stale geometry (dotplot, linear synteny), or a
 * background job that is not a fetch at all (clustering, via `DisplayChrome`).
 * It stays small and out of the way instead of masking the canvas the way the
 * full loading overlay would, and surfaces the statusCallback message plus a
 * determinate bar when the phase reports progress.
 *
 * Pure presentation — the caller owns the gate (its own `refetching` getter, or
 * the chrome's "a status is set while the phase is ready") and the containing
 * element owns the positioning context.
 */
const ProgressChip = observer(function ProgressChip({
  statusMessage,
  statusProgress,
}: {
  statusMessage?: string
  statusProgress?: number
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.root} data-testid="progress-chip">
      <LoadingProgress
        message={statusMessage}
        fraction={statusProgress}
        barClassName={classes.bar}
      />
    </div>
  )
})

export default ProgressChip
