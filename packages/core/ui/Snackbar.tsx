import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MessageSnackbar({ session }: { session?: any }) {
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

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      message={snackbarMessage}
      action={
        <IconButton aria-label="close" color="inherit" onClick={handleClose}>
          <Icon>close</Icon>
        </IconButton>
      }
    />
  )
}

export default observer(MessageSnackbar)
