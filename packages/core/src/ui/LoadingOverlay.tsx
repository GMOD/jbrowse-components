import { useEffect, useState } from 'react'

import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Tooltip } from '@mui/material'

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
 * Keyed on a count of RISING edges rather than on `active` itself, so the
 * falling edge does no work at all. A display refetching through a wheel zoom
 * flips `active` several times a second — it finishes a fetch, waits out the
 * debounce, starts the next — and an effect depending on `active` tore its timer
 * down and built a new one on each of those, twice over, for a scrim that by
 * construction never appears. Deriving the flag from a comparison instead means
 * one `setTimeout` per loading pulse, which is the floor for these semantics.
 */
function useDelayedFlag(active: boolean, delayMs: number) {
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
    // the status chip is the only interactive element; the striped backdrop stays
    // click-through so it never swallows track interactions.
    //
    // Mostly-opaque paper (was 0.4, which let dense features and the striping
    // read straight through the label): the chip sits over a canvas whose colors
    // aren't known here, so the text needs its own backing to stay legible.
    // `background.paper` rather than a literal white so dark mode gets the dark
    // equivalent, and short of fully opaque so it still reads as an overlay.
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
  //
  // The delay runs off `isVisible` ALONE. Feeding `!immediate` in as well made
  // `immediate` *restart* the timer rather than merely bypass it, and the chrome
  // flips `immediate` mid-load: it passes `immediate={!painted}`, so first paint
  // drops it while the phase is still `loading` — region 1 drawn, regions 2..n
  // in flight. The scrim then blinked out for a fresh 250 ms in the middle of
  // one continuous load.
  const shownAfterDelay = useDelayedFlag(!!isVisible, flashDelayMs)
  const shown = !!isVisible && (!!immediate || shownAfterDelay)

  // only offer cancel after the overlay has been continuously visible for a few
  // seconds, so a quick load can't be canceled by an accidental click.
  //
  // Keyed on `shown` rather than `isVisible`, which is what "continuously
  // visible" means and is also what keeps this timer out of a zoom: a display
  // refetching per animation frame flips `isVisible` a couple of times a frame,
  // and each flip was a clearTimeout/setTimeout pair for a five-second delay
  // that could never elapse — 368 timer installs over a ten-second gesture,
  // half of them these.
  const cancelableAfterDelay = useDelayedFlag(shown, cancelDelayMs)
  const cancelable = shown && cancelableAfterDelay

  // Rendered only while shown. The content chip is `pointerEvents:auto`, so
  // leaving it mounted (merely transparent) in the idle state would silently
  // swallow clicks/hovers over the top-center of every track it overlays. There
  // is no fade transition, so mount/unmount is visually identical to toggling
  // opacity anyway.
  return shown ? (
    <span className={classes.overlay} data-testid="loading-overlay">
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
  ) : null
}
