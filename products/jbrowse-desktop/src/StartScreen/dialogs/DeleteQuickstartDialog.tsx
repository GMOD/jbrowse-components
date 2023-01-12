import React, { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Typography from '@mui/material/Typography'
const { ipcRenderer } = window.require('electron')

const DeleteSessionDialog = ({
  quickstartToDelete,
  onClose,
}: {
  quickstartToDelete: string
  onClose: (arg0: boolean) => void
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      title={`Delete ${quickstartToDelete} quickstart?`}
    >
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
