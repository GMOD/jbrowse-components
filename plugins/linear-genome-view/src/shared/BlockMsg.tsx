import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Alert, Tooltip } from '@mui/material'

import type { AlertColor } from '@mui/material'

const useStyles = makeStyles()({
  alert: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
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
      classes={{
        root: classes.alert,
        message: classes.message,
      }}
      onMouseDown={event => {
        event.stopPropagation()
      }}
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <Tooltip title={message}>
        <span className={classes.text}>{message}</span>
      </Tooltip>
      {action}
    </Alert>
  )
}
