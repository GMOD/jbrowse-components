import React, { useState } from 'react'
import { Tooltip, Button, Alert, AlertColor } from '@mui/material'

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
  icon?: any
  action?: () => void
}) {
  const [width, setWidth] = useState(0)
  const button = action ? (
    <Button data-testid="reload_button" onClick={action} startIcon={icon}>
      {buttonText}
    </Button>
  ) : null
  return (
    <div
      ref={ref => {
        if (ref) {
          setWidth(ref.getBoundingClientRect().width)
        }
      }}
    >
      {width < 500 ? (
        <Tooltip title={message}>
          <Alert severity={severity} action={button} />
        </Tooltip>
      ) : (
        <Alert severity={severity} action={button}>
          {message}
        </Alert>
      )}
    </div>
  )
}
