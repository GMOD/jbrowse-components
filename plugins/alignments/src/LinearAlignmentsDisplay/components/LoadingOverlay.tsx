import { cx, keyframes, makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(2px)',
    pointerEvents: 'none',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
    transition: 'opacity 0.3s ease-in-out',
  },
  visible: {
    opacity: 1,
    pointerEvents: 'auto',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '24px 32px',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    textAlign: 'center',
  },
  dots: {
    fontSize: '1rem',
    fontWeight: 400,
    color: '#333',
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
  isVisible,
}: {
  statusMessage?: string
  isVisible?: boolean
}) {
  const { classes } = useStyles()
  return (
    <div
      className={cx(classes.container, isVisible && classes.visible)}
      data-testid={isVisible ? 'loading-overlay' : undefined}
    >
      <div className={classes.content}>
        <span className={classes.dots}>{statusMessage || 'Loading'}</span>
      </div>
    </div>
  )
}
