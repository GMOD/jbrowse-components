import { observer } from 'mobx-react'

import { cx, makeStyles } from '../util/tss-react/index.ts'
import { indeterminateSweep } from './statusProgressKeyframes.ts'

const HEIGHT = 4

const useStyles = makeStyles()(theme => ({
  track: {
    position: 'relative',
    overflow: 'hidden',
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    // `color-mix`, not MUI's `alpha`, keeps this file free of MUI
    background: `color-mix(in srgb, ${theme.palette.accent} 26%, transparent)`,
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    background: theme.palette.accent,
    // scaled from the left rather than sized, so a progress update is a
    // compositor transform instead of a layout
    transformOrigin: 'left center',
    transition: 'transform 200ms linear',
  },
  sweep: {
    width: '40%',
    transition: 'none',
    animation: `${indeterminateSweep} 1.6s infinite linear`,
  },
}))

/**
 * Determinate when given a fraction in [0,1], indeterminate when `undefined`.
 * Callers with an {@link RpcStatus} pass `statusFraction(status)`. Free of MUI
 * so a host's bring-your-own overlays render no Material component;
 * `muiFree.test.ts` and this component's own test hold that.
 */
const StatusProgressBar = observer(function StatusProgressBar({
  fraction,
  label,
  className,
  style,
}: {
  fraction?: number
  label?: string
  className?: string
  style?: React.CSSProperties
}) {
  const { classes } = useStyles()
  const determinate = fraction !== undefined
  const filled = Math.min(1, Math.max(0, fraction ?? 0))
  return (
    <div
      className={cx(classes.track, className)}
      style={style}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(filled * 100) : undefined}
    >
      <div
        className={cx(classes.bar, determinate ? undefined : classes.sweep)}
        style={determinate ? { transform: `scaleX(${filled})` } : undefined}
      />
    </div>
  )
})

export default StatusProgressBar
