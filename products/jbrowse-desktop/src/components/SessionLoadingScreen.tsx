import { LoadingEllipses } from '@jbrowse/core/ui'
import { keyframes, makeStyles } from '@jbrowse/core/util/tss-react'
import { CircularProgress } from '@mui/material'

// anti-flash: a session that opens in a few hundred milliseconds unmounts this
// before the delay elapses and never draws anything
const appear = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

// Layout only: these launch routes all run before a session exists to mount
// StyleThemeProvider, so `makeStyles` here sees the default style theme rather
// than the app's. Color comes off the Material theme instead — the spinner's
// own, and the body color CssBaseline sets, which the label inherits.
const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(4),
    padding: theme.spacing(8),
    animation: `${appear} 0.3s ease-out 0.2s both`,
  },
  fullscreen: {
    position: 'fixed',
    inset: 0,
  },
}))

export default function SessionLoadingScreen({
  message = 'Loading session',
  fullscreen = false,
}: {
  message?: string
  fullscreen?: boolean
}) {
  const { classes, cx } = useStyles()
  return (
    <div className={cx(classes.root, fullscreen ? classes.fullscreen : null)}>
      <CircularProgress size={56} thickness={3.6} />
      <LoadingEllipses variant="h6" message={message} />
    </div>
  )
}
