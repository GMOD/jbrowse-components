import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@material-ui/core'
import { ipcRenderer } from 'electron'

const DeleteSessionDialog = ({
  sessionToDelete,
  onClose,
  setError,
}: {
  sessionToDelete?: string
  onClose: (arg0: boolean) => void
  setError: (e: Error) => void
}) => {
  return (
    <Dialog open={!!sessionToDelete} onClose={() => onClose(false)}>
      <DialogTitle>{`Delete session "${sessionToDelete}"?`}</DialogTitle>
      <DialogContent>
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await ipcRenderer.invoke('deleteSession', sessionToDelete)
              onClose(true)
            } catch (e: any) {
              console.error(e)
              setError(e)
            }
          }}
          color="primary"
          variant="contained"
          autoFocus
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteSessionDialog
