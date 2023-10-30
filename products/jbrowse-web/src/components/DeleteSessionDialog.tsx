import React, { useState } from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'

const DeleteSessionDialog = ({
  sessionToDelete,
  onClose,
  rootModel,
}: {
  sessionToDelete?: string
  onClose: (arg: boolean) => void
  rootModel: {
    removeSavedSession: (arg: { name?: string }) => void
  }
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <Dialog
      open
      maxWidth="xl"
      onClose={() => onClose(false)}
      title={`Delete session "${sessionToDelete}"?`}
    >
      <DialogContent>
        {error ? <ErrorMessage error={error} /> : null}
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                rootModel.removeSavedSession({ name: sessionToDelete })
                onClose(true)
              } catch (e) {
                console.error(e)
                setError(e)
              }
            })()
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
