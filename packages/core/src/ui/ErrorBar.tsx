import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, IconButton, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

const useStyles = makeStyles()({
  ellipses: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  content: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    maxWidth: '80%',
    textAlign: 'center',
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
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <Alert
        severity="error"
        classes={{ message: classes.ellipses }}
        action={
          <Tooltip title="Retry">
            <IconButton onClick={onRetry}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      >
        <Tooltip title={message}>
          <div className={classes.content}>{message}</div>
        </Tooltip>
      </Alert>
    </div>
  )
}
