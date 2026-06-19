import { useEffect, useState } from 'react'

import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Tooltip } from '@mui/material'

import LoadingDots from './LoadingDots.tsx'
import { cx, makeStyles } from '../util/tss-react/index.ts'

const cancelDelayMs = 5000

const useStyles = makeStyles()({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)',
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
    background: 'rgba(255,255,255,0.85)',
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
    height: 4,
    borderRadius: 2,
    background: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#3f88c5',
    transition: 'width 0.15s linear',
  },
})

export default function LoadingOverlay({
  statusMessage,
  progress,
  isVisible,
  canceled,
  onCancel,
  onRetry,
}: {
  statusMessage?: string
  progress?: number
  isVisible?: boolean
  canceled?: boolean
  onCancel?: () => void
  onRetry?: () => void
}) {
  const { classes } = useStyles()
  const hasProgress = progress !== undefined

  // only offer cancel after the overlay has been continuously visible for a few
  // seconds, so a quick load can't be canceled by an accidental click
  const [cancelable, setCancelable] = useState(false)
  useEffect(() => {
    if (isVisible) {
      const id = setTimeout(() => {
        setCancelable(true)
      }, cancelDelayMs)
      return () => {
        clearTimeout(id)
      }
    } else {
      setCancelable(false)
      return undefined
    }
  }, [isVisible])

  return (
    <span
      className={cx(classes.overlay, isVisible && classes.visible)}
      data-testid={isVisible ? 'loading-overlay' : undefined}
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
                {statusMessage || 'Loading'}
                {hasProgress ? (
                  ` ${Math.round(progress * 100)}%`
                ) : (
                  <LoadingDots />
                )}
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
              <span className={classes.bar}>
                <span
                  className={classes.barFill}
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </span>
            ) : null}
          </>
        )}
      </span>
    </span>
  )
}
