import React, { useEffect, useState } from 'react'
import { Button, IconButton, Snackbar } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import Alert from '@mui/lab/Alert'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
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
  const [open, setOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarMessage>()

  const { popSnackbarMessage, snackbarMessages } = session

  const latestMessage = snackbarMessages.length
    ? snackbarMessages[snackbarMessages.length - 1]
    : null

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    if (snackbarMessage) {
      if (!latestMessage) {
        setSnackbarMessage(undefined)
      } else if (snackbarMessage[0] !== latestMessage[0]) {
        setOpen(false)
        timeoutId = setTimeout(() => {
          setSnackbarMessage(latestMessage)
          setOpen(true)
        }, 100)
      }
    } else if (latestMessage) {
      setSnackbarMessage(latestMessage)
      setOpen(true)
    }

    return () => {
      clearTimeout(timeoutId)
    }
  }, [latestMessage, snackbarMessage])

  const handleClose = (_event: unknown, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }
    popSnackbarMessage()
    setOpen(false)
  }
  const [message, level, action] = snackbarMessage || []
  return (
    <Snackbar
      open={open && !!message}
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
              <IconButton
                aria-label="close"
                color="inherit"
                onClick={handleClose}
              >
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
