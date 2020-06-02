import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import CloseIcon from '@material-ui/icons/Close'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { AbstractSessionModel } from '../util'

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: unknown[]
  popSnackbarMessage: () => unknown
}

function MessageSnackbar({
  session,
}: {
  session: SnackbarSession & IAnyStateTreeNode
}) {
  const [open, setOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const { popSnackbarMessage, snackbarMessages } = session

  const latestMessage = snackbarMessages.length
    ? snackbarMessages[snackbarMessages.length - 1]
    : null

  useEffect(() => {
    let timeoutId: NodeJS.Timer

    if (snackbarMessage) {
      if (!latestMessage) {
        setSnackbarMessage('')
      } else if (snackbarMessage !== latestMessage) {
        setOpen(false)
        timeoutId = setTimeout(() => {
          setSnackbarMessage(String(latestMessage))
          setOpen(true)
        }, 100)
      }
    } else if (latestMessage) {
      setSnackbarMessage(String(latestMessage))
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

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      message={snackbarMessage}
      action={
        <IconButton aria-label="close" color="inherit" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      }
    />
  )
}

export default observer(MessageSnackbar)
