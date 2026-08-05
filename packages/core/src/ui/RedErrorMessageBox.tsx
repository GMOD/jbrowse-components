import { makeStyles } from '../util/tss-react/index.ts'

const useStyles = makeStyles()(theme => ({
  bg: {
    padding: 4,
    margin: 4,
    overflow: 'auto',
    background: theme.palette.mode === 'dark' ? '#833' : '#f88',
    border: `1px solid ${theme.palette.divider}`,
  },
}))

// The test-id, not the color, is what says "an error is on screen": this is the
// box ErrorMessage and ErrorBanner both render into, and it is the one error
// surface the website capture harness could not see. `ErrorBar` publishes
// `reload_button` and `notifyError` publishes `snackbar-error`, so a capture
// that still showed either failed loudly — but an MST type error surfacing here
// over a view was captured and committed as if the figure were fine. Keying off
// `#f88` instead would break on the dark theme and on any restyle.
export default function RedErrorMessageBox({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.bg} data-testid="error-message-box">
      {children}
    </div>
  )
}
