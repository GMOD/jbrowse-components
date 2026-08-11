import { useState } from 'react'

import { ConfirmDialog, ErrorMessage } from '@jbrowse/core/ui'
import { DialogContentText, TextField } from '@mui/material'

import { invokeIpc } from '../../../ipc.ts'
import { useIpcAction } from './useIpcAction.ts'

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
  // A quickstart is stored under its name, so a blank one has nowhere to live —
  // it used to move the file to a name listQuickstarts never returns, which read
  // as the quickstart having been deleted. See assertQuickstartName.
  const nameBlank = !newName.trim()
  const { error, pending, onSubmit } = useIpcAction(async () => {
    if (nameBlank) {
      throw new Error('Quickstart name cannot be empty')
    }
    if (nameConflict) {
      throw new Error('A quickstart with this name already exists')
    }
    await invokeIpc('renameQuickstart', quickstartToRename, newName)
  }, onClose)

  return (
    <ConfirmDialog
      open
      maxWidth="xs"
      fullWidth
      title="Rename quickstart"
      submitDisabled={pending || nameBlank}
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
