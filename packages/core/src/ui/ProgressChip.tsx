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
    // Kept out of `anchored` below, because it has to hold in both modes and
    // does: a flex item honours `z-index` with no `position` of its own
    // (Flexbox §5.4). In the chrome's shared corner this is what keeps the chip
    // under the tree sidebar and the legends at 100, where it has always been.
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
  // Separated from the presentation above because the two callers differ on who
  // owns the corner. The comparative views drop this chip straight into their
  // own positioned box and want it anchored; `DisplayChrome` puts it in a corner
  // the chrome itself anchors and shares with the display's control row, and an
  // absolutely-positioned chip there sits *under* that row instead of above it
  // — which is the collision this split fixes.
  anchored: {
    position: 'absolute',
    bottom: 2,
    right: 2,
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
 *
 * It also owns the corner, unless `anchored={false}` says something else does.
 * That escape exists because on the LGV side the corner is shared: the chrome
 * anchors one box for both this and the display's control row, and a chip that
 * pins itself lands *under* that row rather than above it.
 */
const ProgressChip = observer(function ProgressChip({
  status,
  anchored = true,
}: {
  /**
   * What to show. One object rather than a message and a fraction side by side,
   * so a `createStatusChannel` holder passes `status={model.fetchStatus}` and
   * nothing has to restate the pair — the field names are the channel's, and
   * {@link LoadingProgress}'s.
   */
  status: { message?: string; fraction?: number }
  /**
   * Pin to the bottom-right of the containing block (the default, and what a
   * caller dropping this into its own positioned box wants). Pass `false` where
   * something else already owns that corner and lays this out — `DisplayChrome`
   * shares it with the display's control row.
   */
  anchored?: boolean
}) {
  const { classes, cx } = useStyles()
  return (
    <div
      className={cx(classes.root, anchored ? classes.anchored : undefined)}
      data-testid="progress-chip"
    >
      <LoadingProgress
        message={status.message}
        fraction={status.fraction}
        barClassName={classes.bar}
      />
    </div>
  )
})

export default ProgressChip
