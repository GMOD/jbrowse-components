import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, TextField } from '@mui/material'

import { useIpcAction } from './useIpcAction.ts'

const { ipcRenderer } = window.require('electron')

export default function RenameSessionDialog({
  sessionToRename,
  onClose,
}: {
  sessionToRename: { path: string; name: string }
  onClose: () => void
}) {
  const [newName, setNewName] = useState(sessionToRename.name)
  const { error, onSubmit } = useIpcAction(async () => {
    if (!newName.trim()) {
      throw new Error('Session name cannot be empty')
    }
    await ipcRenderer.invoke('renameSession', sessionToRename.path, newName)
  }, onClose)
  return (
    <ConfirmDialog
      open
      maxWidth="xs"
      fullWidth
      title="Rename session"
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>
        Please enter a new name for the session:
      </DialogContentText>
      <TextField
        autoFocus
        fullWidth
        variant="outlined"
        margin="dense"
        value={newName}
        onChange={event => {
          setNewName(event.target.value)
        }}
      />
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
