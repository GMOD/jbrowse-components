import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, IconButton, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import StackTraceButton from './StackTraceButton.tsx'

const useStyles = makeStyles()({
  content: {
    wordBreak: 'break-word',
    textAlign: 'center',
    // displays wrap their canvas in user-select:none (e.g. the canvas
    // FeatureComponent root, inherited by DisplayChrome's error bar); re-enable
    // selection so the error text can be copied
    userSelect: 'text',
  },
})

export default function ErrorBar({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const { classes } = useStyles()
  const message = `${error}`
  return (
    <div
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <Alert
        severity="error"
        action={
          <>
            <StackTraceButton error={error} />
            <Tooltip title="Retry">
              <IconButton
                data-testid="reload_button"
                onClick={() => {
                  onRetry()
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </>
        }
      >
        <Tooltip title={message}>
          <div className={classes.content}>{message}</div>
        </Tooltip>
      </Alert>
    </div>
  )
}
