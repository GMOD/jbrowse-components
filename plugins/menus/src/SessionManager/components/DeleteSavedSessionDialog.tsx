import React from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

export default function DeleteSavedSessionDialog({
  sessionNameToDelete,
  handleClose,
}: {
  sessionNameToDelete: string
  handleClose: (arg?: boolean) => void
}) {
  return (
    <Dialog open title={`Delete session "${sessionNameToDelete}"?`}>
      <DialogContent>
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          autoFocus
          onClick={() => {
            handleClose(true)
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}
