import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Alert, Tooltip } from '@mui/material'

import type { AlertColor } from '@mui/material'

const useStyles = makeStyles()({
  ellipses: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  content: {
    maxWidth: '100%',
    textAlign: 'center',
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
      classes={{
        message: classes.ellipses,
      }}
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
