import React from 'react'
import { Tooltip, Button, Alert, AlertColor } from '@mui/material'
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
  buttonText,
  icon,
  action,
}: {
  message: string
  severity?: AlertColor
  buttonText?: string
  icon?: React.ReactNode
  action?: () => void
}) {
  const { classes } = useStyles()
  const button = action ? (
    <Button data-testid="reload_button" onClick={action} startIcon={icon}>
      {buttonText}
    </Button>
  ) : null
  return (
    <Alert
      severity={severity}
      action={button}
      classes={{ message: classes.ellipses }}
    >
      <Tooltip title={message}>
        <div>{message}</div>
      </Tooltip>
    </Alert>
  )
}
