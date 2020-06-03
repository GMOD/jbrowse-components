import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import CloseIcon from '@material-ui/icons/Close'
import Alert from '@material-ui/lab/Alert'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { AbstractSessionModel, NotificationLevel } from '../util'

type SnackbarMessage = [string, NotificationLevel]

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
  const [snackbarMessage, setSnackbarMessage] = useState<
    SnackbarMessage | undefined
  >()

  const { popSnackbarMessage, snackbarMessages } = session

  const latestMessage = snackbarMessages.length
    ? snackbarMessages[snackbarMessages.length - 1]
    : null

  useEffect(() => {
    let timeoutId: NodeJS.Timer

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

  const handleClose = (
    event: React.SyntheticEvent | MouseEvent,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return
    }
    popSnackbarMessage()
    setOpen(false)
  }

  const [message, level] = snackbarMessage || []
  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      action={
        <IconButton aria-label="close" color="inherit" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      }
    >
      <Alert onClose={handleClose} severity={level || 'warning'}>
        {message}
      </Alert>
    </Snackbar>
  )
}

export default observer(MessageSnackbar)
