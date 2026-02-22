import { cx, keyframes, makeStyles } from '../util/tss-react/index.ts'

const dot1 = keyframes`
  0%, 25% { visibility: hidden; }
  25.1%, 100% { visibility: visible; }
`
const dot2 = keyframes`
  0%, 50% { visibility: hidden; }
  50.1%, 100% { visibility: visible; }
`
const dot3 = keyframes`
  0%, 75% { visibility: hidden; }
  75.1%, 100% { visibility: visible; }
`

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
  dots: {
    display: 'inline-block',
    width: '1em',
    textAlign: 'left',
    '& span': {
      visibility: 'hidden',
      '&:nth-of-type(1)': {
        animation: `${dot1} 1.2s infinite`,
      },
      '&:nth-of-type(2)': {
        animation: `${dot2} 1.2s infinite`,
      },
      '&:nth-of-type(3)': {
        animation: `${dot3} 1.2s infinite`,
      },
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
    <span
      className={cx(classes.overlay, isVisible && classes.visible)}
      data-testid={isVisible ? 'loading-overlay' : undefined}
    >
      <span className={classes.text}>
        {statusMessage || 'Loading'}
        <span className={classes.dots}>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </span>
  )
}
