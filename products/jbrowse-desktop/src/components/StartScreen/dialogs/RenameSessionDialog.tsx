import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, TextField } from '@mui/material'

import { invokeIpc } from '../../../ipc.ts'
import { useIpcAction } from './useIpcAction.ts'

export default function RenameSessionDialog({
  sessionToRename,
  onClose,
}: {
  sessionToRename: { path: string; name: string }
  onClose: () => void
}) {
  const [newName, setNewName] = useState(sessionToRename.name)
  const { error, pending, onSubmit } = useIpcAction(async () => {
    if (!newName.trim()) {
      throw new Error('Session name cannot be empty')
    }
    await invokeIpc('renameSession', sessionToRename.path, newName)
  }, onClose)
  return (
    <ConfirmDialog
      open
      maxWidth="xs"
      fullWidth
      title="Rename session"
      submitDisabled={pending}
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
