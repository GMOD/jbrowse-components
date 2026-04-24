import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Alert, Tooltip } from '@mui/material'

import type { AlertColor } from '@mui/material'

const useStyles = makeStyles()({
  content: {
    maxWidth: '100%',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
})

export default function BlockMsg({
  message,
  severity,
  action,
}: {
  message: string
  severity?: AlertColor
  action?: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <Alert
      severity={severity}
      action={action}
      onMouseDown={event => {
        event.stopPropagation()
      }}
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <Tooltip title={message}>
        <div className={classes.content}>{message}</div>
      </Tooltip>
    </Alert>
  )
}
