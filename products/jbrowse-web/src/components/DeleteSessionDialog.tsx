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
  rootModel,
  onClose,
}: {
  sessionToDelete?: string
  rootModel: WebRootModel
  onClose: (_arg0: boolean) => void
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <Dialog
      open
      title={`Delete session "${sessionToDelete}"?`}
      onClose={() => {
        onClose(false)
      }}
    >
      <DialogContent>
        {error ? <ErrorMessage error={error} /> : null}
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          onClick={() => {
            onClose(false)
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {}}
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
