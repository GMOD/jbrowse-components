import React from 'react'
import { Alert, Button, IconButton, Snackbar } from '@mui/material'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'

// icons
import CloseIcon from '@mui/icons-material/Close'

// locals
import { AbstractSessionModel, NotificationLevel, SnackAction } from '../util'

type SnackbarMessage = [string, NotificationLevel, SnackAction]

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
}

function MessageSnackbar({
  session,
}: {
  session: SnackbarSession & IAnyStateTreeNode
}) {
  const { popSnackbarMessage, snackbarMessages } = session

  const latestMessage = snackbarMessages.length
    ? snackbarMessages[snackbarMessages.length - 1]
    : null

  const handleClose = (_event: unknown, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }
    popSnackbarMessage()
  }
  const open = !!latestMessage
  const [message, level, action] = latestMessage || []
  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        action={
          action ? (
            <>
              <Button
                color="inherit"
                onClick={e => {
                  action.onClick()
                  handleClose(e)
                }}
              >
                {action.name}
              </Button>
              <IconButton color="inherit" onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </>
          ) : null
        }
        severity={level || 'warning'}
      >
        {message}
      </Alert>
    </Snackbar>
  )
}

export default observer(MessageSnackbar)
