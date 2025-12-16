import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'

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
  },
  message: {
    zIndex: 2,
    pointerEvents: 'none',
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
  return (
    <div className={classes.container}>
      {children}
      <div className={classes.overlay} data-testid="loading-overlay">
        <div className={classes.message}>
          <LoadingEllipses message={statusMessage} />
        </div>
      </div>
    </div>
  )
}
