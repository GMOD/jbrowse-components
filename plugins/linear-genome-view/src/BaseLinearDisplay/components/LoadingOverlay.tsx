import { cx, keyframes, makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)',
    pointerEvents: 'none',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
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
})

export default function LoadingOverlay({
  statusMessage,
  children,
}: {
  statusMessage?: string
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const isLoading = !!statusMessage
  return (
    <div className={classes.container}>
      {children}
      <span
        className={cx(classes.overlay, isLoading && classes.visible)}
        data-testid="loading-overlay"
      >
        <span className={classes.dots}>{statusMessage || 'Loading'}</span>
      </span>
    </div>
  )
}
