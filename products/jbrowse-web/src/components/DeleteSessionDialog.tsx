import React, { useState } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import type { WebRootModel } from '../rootModel/rootModel'

const DeleteSessionDialog = ({
  sessionToDelete,
  onClose,
  rootModel,
}: {
  sessionToDelete?: string
  onClose: (_arg0: boolean) => void
  rootModel: WebRootModel
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <Dialog
      open
      onClose={() => {
        onClose(false)
      }}
      title={`Delete session "${sessionToDelete}"?`}
    >
      <DialogContent>
        {error ? <ErrorMessage error={error} /> : null}
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
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                if (sessionToDelete) {
                  rootModel.removeSavedSession({ name: sessionToDelete })
                }
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
