import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

export default function DeleteSavedSessionDialog({
  open,
  sessionNameToDelete,
  handleClose,
}: {
  sessionNameToDelete: string
  open: boolean
  handleClose: (arg?: boolean) => void
}) {
  return (
    <Dialog open={open} title={`Delete session "${sessionNameToDelete}"?`}>
      <DialogContent>
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            handleClose(true)
          }}
          color="primary"
          autoFocus
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}
