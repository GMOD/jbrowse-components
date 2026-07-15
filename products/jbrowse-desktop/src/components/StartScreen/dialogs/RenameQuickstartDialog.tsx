import { useState } from 'react'

import { ConfirmDialog, ErrorMessage } from '@jbrowse/core/ui'
import { DialogContentText, TextField } from '@mui/material'

import { useIpcAction } from './useIpcAction.ts'

const { ipcRenderer } = window.require('electron')

export default function RenameQuickstartDialog({
  quickstartNames,
  quickstartToRename,
  onClose,
}: {
  quickstartNames: string[]
  quickstartToRename: string
  onClose: () => void
}) {
  const [newName, setNewName] = useState(quickstartToRename)
  // exclude the current name: the dialog opens with newName === the name being
  // renamed, which is (by definition) already in the list, so an unqualified
  // includes() flags a spurious conflict the moment the dialog opens
  const nameConflict =
    newName !== quickstartToRename && quickstartNames.includes(newName)
  const { error, onSubmit } = useIpcAction(async () => {
    if (nameConflict) {
      throw new Error('A quickstart with this name already exists')
    }
    await ipcRenderer.invoke('renameQuickstart', quickstartToRename, newName)
  }, onClose)

  return (
    <ConfirmDialog
      open
      maxWidth="xs"
      fullWidth
      title="Rename quickstart"
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>
        Please enter a new name for the quickstart:
      </DialogContentText>
      {nameConflict ? (
        <DialogContentText color="error">
          There is already a quickstart named &quot;{newName}&quot;
        </DialogContentText>
      ) : null}
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
