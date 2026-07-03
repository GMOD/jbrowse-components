import { useEffect, useState } from 'react'

import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Tooltip } from '@mui/material'
import { alpha } from '@mui/material/styles'

import LoadingDots from './LoadingDots.tsx'
import StatusProgressBar from './StatusProgressBar.tsx'
import { progressLabel } from '../util/progress.ts'
import { cx, makeStyles } from '../util/tss-react/index.ts'

const cancelDelayMs = 5000

// suppress the overlay for the first moments of a refetch so quick zoom/pan
// loads stay silent and only genuinely slow loads ever draw the indicator.
// Skipped when `immediate` is set (initial load with nothing on screen yet) —
// there's no content to flash over, so the indicator shows right away.
const flashDelayMs = 250

// Returns false, then flips true once `active` has stayed true continuously for
// `delayMs`. Resets to false the moment `active` goes false, so each activation
// gets a fresh delay.
function useDelayedFlag(active: boolean, delayMs: number) {
  const [flag, setFlag] = useState(false)
  useEffect(() => {
    if (active) {
      const id = setTimeout(() => {
        setFlag(true)
      }, delayMs)
      return () => {
        clearTimeout(id)
        setFlag(false)
      }
    }
    return undefined
  }, [active, delayMs])
  return flag
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
      opacity: 0,
      paddingTop: '20px',
    },
    visible: {
      opacity: 1,
    },
    // the status chip is the only interactive element; the striped backdrop stays
    // click-through so it never swallows track interactions
    content: {
      pointerEvents: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      background: alpha(theme.palette.background.paper, 0.4),
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

export default function LoadingOverlay({
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
  const hasProgress = progress !== undefined

  // anti-flash: only render after the load has run long enough to be worth
  // signaling, so fast loads show nothing at all. `immediate` bypasses this for
  // initial loads, where nothing is on screen to flash over yet.
  const shownAfterDelay = useDelayedFlag(
    !!isVisible && !immediate,
    flashDelayMs,
  )
  const shown = isVisible && (immediate || shownAfterDelay)

  // only offer cancel after the overlay has been continuously visible for a few
  // seconds, so a quick load can't be canceled by an accidental click
  const cancelableAfterDelay = useDelayedFlag(!!isVisible, cancelDelayMs)
  const cancelable = isVisible && cancelableAfterDelay

  return (
    <span
      className={cx(classes.overlay, shown && classes.visible)}
      data-testid={shown ? 'loading-overlay' : undefined}
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
                {progressLabel(statusMessage || 'Loading', progress)}
                {hasProgress ? null : <LoadingDots />}
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
            {hasProgress ? (
              <StatusProgressBar className={classes.bar} fraction={progress} />
            ) : null}
          </>
        )}
      </span>
    </span>
  )
}
