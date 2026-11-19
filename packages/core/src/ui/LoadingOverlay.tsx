import { useEffect, useState } from 'react'

import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { progressLabel } from '../util/progress.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import LoadingDots from './LoadingDots.tsx'
import StatusProgressBar from './StatusProgressBar.tsx'
import { alpha } from './palette.ts'

const cancelDelayMs = 5000

// suppress the overlay for the first moments of a refetch so quick zoom/pan
// loads stay silent and only genuinely slow loads ever draw the indicator.
// Skipped when `immediate` is set (initial load with nothing on screen yet) —
// there's no content to flash over, so the indicator shows right away.
const flashDelayMs = 250

/**
 * Returns false, then flips true once `active` has stayed true continuously for
 * `delayMs`. Each activation gets a fresh delay, and the flag drops the moment
 * `active` does.
 *
 * Keyed on a count of rising edges, not on `active`, so a display flipping
 * `active` several times a second through a zoom installs one timer per pulse.
 */
export function useDelayedFlag(active: boolean, delayMs: number) {
  const [previous, setPrevious] = useState(active)
  const [activation, setActivation] = useState(0)
  if (previous !== active) {
    setPrevious(active)
    if (active) {
      setActivation(n => n + 1)
    }
  }
  const [elapsedFor, setElapsedFor] = useState(-1)
  useEffect(() => {
    const id = setTimeout(() => {
      setElapsedFor(activation)
    }, delayMs)
    return () => {
      clearTimeout(id)
    }
  }, [activation, delayMs])
  return active && elapsedFor === activation
}

const useStyles = makeStyles()(theme => {
  // derive the stripe + chip tints from the theme so the "something's happening"
  // signal stays subtle and equally visible in light and dark mode
  const stripe = alpha(theme.palette.text.primary, 0.05)
  return {
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `repeating-linear-gradient(45deg, transparent, transparent 8px, ${stripe} 8px, ${stripe} 16px)`,
      pointerEvents: 'none',
      zIndex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '20px',
    },
    // the only interactive part; the striped backdrop stays click-through
    content: {
      pointerEvents: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      background: alpha(theme.palette.background.paper, 0.85),
      borderRadius: 4,
      padding: '2px 8px',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    text: {
      fontSize: '0.8rem',
      fontWeight: 300,
    },
    bar: {
      width: 160,
    },
  }
})

const LoadingOverlay = observer(function LoadingOverlay({
  statusMessage,
  progress,
  isVisible,
  immediate,
  canceled,
  onCancel,
  onRetry,
}: {
  statusMessage?: string
  progress?: number
  isVisible?: boolean
  immediate?: boolean
  canceled?: boolean
  onCancel?: () => void
  onRetry?: () => void
}) {
  const { classes } = useStyles()
  const label = statusMessage || 'Loading'

  // `immediate` bypasses the anti-flash delay but must not restart it: the
  // chrome drops it at first paint, mid-load
  const shownAfterDelay = useDelayedFlag(!!isVisible, flashDelayMs)
  const shown = !!isVisible && (!!immediate || shownAfterDelay)
  const cancelableAfterDelay = useDelayedFlag(shown, cancelDelayMs)
  const cancelable = shown && cancelableAfterDelay

  // unmounted rather than hidden: the chip takes pointer events. The canceled
  // state is finished work, so it does not publish `loading-overlay`
  return shown ? (
    <span
      className={classes.overlay}
      data-testid={canceled ? 'loading-overlay-canceled' : 'loading-overlay'}
    >
      <span className={classes.content}>
        {canceled ? (
          <span className={classes.row}>
            <span className={classes.text}>Loading canceled</span>
            {onRetry ? (
              <Tooltip title="Retry">
                <IconButton
                  size="small"
                  data-testid="loading-overlay-retry"
                  onClick={() => {
                    onRetry()
                  }}
                >
                  <RefreshIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            ) : null}
          </span>
        ) : (
          <>
            <span className={classes.row}>
              <span className={classes.text}>
                {progressLabel(label, progress)}
                {progress === undefined ? <LoadingDots /> : null}
              </span>
              {onCancel && cancelable ? (
                <Tooltip title="Cancel">
                  <IconButton
                    size="small"
                    data-testid="loading-overlay-cancel"
                    onClick={() => {
                      onCancel()
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </span>
            {progress === undefined ? null : (
              <StatusProgressBar
                className={classes.bar}
                fraction={progress}
                label={label}
              />
            )}
          </>
        )}
      </span>
    </span>
  ) : null
})

export default LoadingOverlay
