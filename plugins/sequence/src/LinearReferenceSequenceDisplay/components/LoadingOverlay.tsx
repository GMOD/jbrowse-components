import { cx, keyframes, makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(theme.palette.background.paper, 0.15),
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, ${alpha(theme.palette.text.primary, 0.05)} 8px, ${alpha(theme.palette.text.primary, 0.05)} 16px)`,
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
  dots: {
    fontSize: '0.8rem',
    fontWeight: 300,
    '&::after': {
      display: 'inline-block',
      content: '""',
      width: '1em',
      textAlign: 'left',
      animation: `${keyframes`
        0% { content: ''; }
        25% { content: '.'; }
        50% { content: '..'; }
        75% { content: '...'; }
      `} 1.2s infinite ease-in-out`,
    },
  },
}))

export default function LoadingOverlay({
  statusMessage,
  isVisible,
}: {
  statusMessage?: string
  isVisible?: boolean
}) {
  const { classes } = useStyles()
  return (
    <span
      className={cx(classes.overlay, isVisible && classes.visible)}
      data-testid={isVisible ? 'loading-overlay' : undefined}
    >
      <span className={classes.dots}>{statusMessage || 'Loading'}</span>
    </span>
  )
}
