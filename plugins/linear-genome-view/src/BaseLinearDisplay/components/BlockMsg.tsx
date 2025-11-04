import { Alert, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import type { AlertColor } from '@mui/material'

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
      classes={{
        message: classes.ellipses,
      }}
      onMouseDown={event => {
        event.stopPropagation()
      }}
      onClick={event => {
        // avoid clicks on block messages from turning into double-click zoom
        event.stopPropagation()
      }}
    >
      <Tooltip title={message}>
        <div>{message}</div>
      </Tooltip>
    </Alert>
  )
}
