import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
const { ipcRenderer } = window.require('electron')

const DeleteSessionDialog = ({
  sessionsToDelete,
  onClose,
  setError,
}: {
  sessionsToDelete: { path: string }[]
  onClose: (arg0: boolean) => void
  setError: (e: unknown) => void
}) => {
  return (
    <Dialog
      open
      onClose={() => {
        onClose(false)
      }}
      title={`Delete ${sessionsToDelete.length} sessions?`}
    >
      <DialogContent>
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose(false)
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await ipcRenderer.invoke(
                'deleteSessions',
                sessionsToDelete.map(s => s.path),
              )
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
