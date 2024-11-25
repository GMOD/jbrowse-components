import React from 'react'
import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Button,
  IconButton,
  Snackbar as MUISnackbar,
} from '@mui/material'
import { observer } from 'mobx-react'

// icons

// locals
import type { AbstractSessionModel } from '../util'
import type { SnackbarMessage } from './SnackbarModel'

interface SnackbarSession extends AbstractSessionModel {
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => void
}

const Snackbar = observer(function ({ session }: { session: SnackbarSession }) {
  const { snackbarMessages } = session
  const latestMessage = snackbarMessages.at(-1)

  const handleClose = (_event: unknown, reason?: string) => {
    if (reason !== 'clickaway') {
      session.popSnackbarMessage()
    }
  }
  return latestMessage ? (
    <MUISnackbar
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
    </MUISnackbar>
  ) : null
})

export default Snackbar
