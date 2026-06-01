import LoadingDots from './LoadingDots.tsx'
import { cx, makeStyles } from '../util/tss-react/index.ts'

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
  text: {
    fontSize: '0.8rem',
    fontWeight: 300,
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
    <span
      className={cx(classes.overlay, isVisible && classes.visible)}
      data-testid={isVisible ? 'loading-overlay' : undefined}
    >
      <span className={classes.text}>
        {statusMessage || 'Loading'}
        <LoadingDots />
      </span>
    </span>
  )
}
