import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Tooltip } from '@mui/material'

import RedErrorMessageBox from './RedErrorMessageBox.tsx'
import StackTraceButton from './StackTraceButton.tsx'
import { parseError } from './parseError.ts'
import { makeStyles } from '../util/tss-react/index.ts'

const useStyles = makeStyles()(theme => ({
  bg: {
    background: theme.palette.divider,
    border: '1px solid black',
    margin: 20,
  },
  message: {
    background: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    padding: '12px 16px',
    margin: '16px 20px',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
  },
  iconFloat: {
    float: 'right',
    marginLeft: 100,
  },
}))

function ErrorButtons({
  error,
  onReset,
}: {
  error: unknown
  onReset?: () => void
}) {
  const { classes } = useStyles()
  const hasStack = typeof error === 'object' && error && 'stack' in error
  return (
    <div className={classes.iconFloat}>
      {hasStack ? <StackTraceButton error={error} color="primary" /> : null}
      {onReset ? (
        <Tooltip title="Retry">
          <IconButton
            onClick={() => {
              onReset()
            }}
            color="primary"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  )
}

function ErrorBanner({
  error,
  onReset,
}: {
  error: unknown
  onReset?: () => void
}) {
  const { classes } = useStyles()
  const errorText = `${error}`
  // the "expected an instance of ..." tail from MST is noise; trim it from the
  // displayed text (but still parse the full string below for the snapshot dump)
  const instanceIdx = errorText.indexOf('expected an instance of')
  const displayText =
    instanceIdx === -1 ? errorText : errorText.slice(0, instanceIdx)
  const { snapshotError, message } = parseError(errorText)
  return (
    <RedErrorMessageBox>
      {displayText.slice(0, 10000)}
      <ErrorButtons error={error} onReset={onReset} />
      {message ? <div className={classes.message}>{message}</div> : null}
      {snapshotError ? (
        <pre className={classes.bg}>
          {JSON.stringify(JSON.parse(snapshotError), null, 2)}
        </pre>
      ) : null}
    </RedErrorMessageBox>
  )
}

export default ErrorBanner
