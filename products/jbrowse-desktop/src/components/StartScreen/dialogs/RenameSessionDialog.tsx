import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, Input } from '@mui/material'

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
  const { error, onSubmit } = useIpcAction(
    () => ipcRenderer.invoke('renameSession', sessionToRename.path, newName),
    onClose,
  )
  return (
    <ConfirmDialog
      open
      title="Rename session"
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>
        Please enter a new name for the session:
      </DialogContentText>
      <Input
        autoFocus
        value={newName}
        onChange={event => {
          setNewName(event.target.value)
        }}
      />
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
