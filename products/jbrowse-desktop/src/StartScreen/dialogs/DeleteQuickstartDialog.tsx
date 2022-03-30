import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@material-ui/core'
import { ipcRenderer } from 'electron'

const DeleteSessionDialog = ({
  quickstartToDelete,
  onClose,
}: {
  quickstartToDelete: string;
  onClose: (arg0: boolean) => void;
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <Dialog open onClose={() => onClose(false)}>
      <DialogTitle>{`Delete ${quickstartToDelete} quickstart?`}</DialogTitle>
      <DialogContent>
        <DialogContentText>This action cannot be undone</DialogContentText>
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await ipcRenderer.invoke('deleteQuickstart', quickstartToDelete)
              onClose(true)
            } catch (e) {
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
