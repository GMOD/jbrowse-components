import React from 'react'
import { Alert, Button, IconButton, Snackbar } from '@mui/material'
import { observer } from 'mobx-react'

// icons
import CloseIcon from '@mui/icons-material/Close'

// locals
import { AbstractSessionModel } from '../util'
import { SnackbarMessage } from './SnackbarModel'

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => void
}

export default observer(function MessageSnackbar({
  session,
}: {
  session: SnackbarSession
}) {
  const { snackbarMessages } = session
  const latestMessage = snackbarMessages.at(-1)

  const handleClose = (_event: unknown, reason?: string) => {
    if (reason !== 'clickaway') {
      session.popSnackbarMessage()
    }
  }
  return !!latestMessage ? (
    <Snackbar
      open
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        action={
          latestMessage.action ? (
            <>
              <Button
                color="inherit"
                onClick={e => {
                  latestMessage.action?.onClick()
                  handleClose(e)
                }}
              >
                {latestMessage.action.name}
              </Button>
              <IconButton color="inherit" onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </>
          ) : null
        }
        severity={latestMessage.level || 'warning'}
      >
        {latestMessage.message}
      </Alert>
    </Snackbar>
  ) : null
})
