import { observer } from 'mobx-react'

import { keyframes, makeStyles } from '../util/tss-react/index.ts'
import LoadingProgress from './LoadingProgress.tsx'
import { alpha } from './palette.ts'

// anti-flash: a job that finishes inside the delay unmounts the chip unseen
const appear = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const useStyles = makeStyles()(theme => ({
  root: {
    // a flex item honours z-index without a position of its own, so this holds
    // in the chrome's shared corner too, under the tree sidebar and legends
    zIndex: 2,
    pointerEvents: 'none',
    padding: '0 4px',
    borderRadius: 4,
    background: alpha(theme.palette.background.paper, 0.8),
    animation: `${appear} 0s linear 0.25s both`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
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
 * Bottom-right progress chip for work running while usable content is already
 * on screen, such as a refetch over stale geometry or a clustering job. The
 * caller owns the gate.
 */
const ProgressChip = observer(function ProgressChip({
  status,
  anchored = true,
}: {
  status: { message?: string; fraction?: number }
  /**
   * false where something else lays out the corner: `DisplayChrome` shares it
   * with the display's control row, and a self-pinned chip would sit under it
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
