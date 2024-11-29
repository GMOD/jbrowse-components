import React from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function DeleteSavedSessionDialog({
  snap,
  session,
  handleClose,
}: {
  snap: { name: string }
  session: AbstractSessionModel
  handleClose: (arg?: boolean) => void
}) {
  return (
    <Dialog open title={`Delete session "${snap.name}"?`}>
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
