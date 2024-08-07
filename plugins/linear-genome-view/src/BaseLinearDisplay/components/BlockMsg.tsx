import React from 'react'
import { Tooltip, Alert, AlertColor } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  ellipses: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
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
      classes={{ message: classes.ellipses }}
    >
      <Tooltip title={message}>
        <div>{message}</div>
      </Tooltip>
    </Alert>
  )
}
