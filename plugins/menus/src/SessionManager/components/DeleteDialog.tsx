import React from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

export default function DeleteDialog({
  open,
  sessionNameToDelete,
  handleClose,
}: {
  sessionNameToDelete: string
  open: boolean
  handleClose: (arg?: boolean) => void
}) {
  return (
    <Dialog
      open={open}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      title={`Delete session "${sessionNameToDelete}"?`}
    >
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          This action cannot be undone
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()} color="primary">
          Cancel
        </Button>
        <Button onClick={() => handleClose(true)} color="primary" autoFocus>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}
