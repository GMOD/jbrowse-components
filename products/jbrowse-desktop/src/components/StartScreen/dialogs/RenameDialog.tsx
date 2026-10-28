import { useState } from 'react'

import { ConfirmDialog, ErrorMessage } from '@jbrowse/core/ui'
import { DialogContentText, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { useIpcAction } from './useIpcAction.ts'

const RenameDialog = observer(function RenameDialog({
  noun,
  name,
  takenNames = [],
  rename,
  onClose,
}: {
  noun: 'session' | 'quickstart'
  name: string
  // names a new one may not take; the current name is excluded, since the
  // dialog opens holding it
  takenNames?: string[]
  rename: (newName: string) => Promise<void>
  onClose: () => void
}) {
  const [newName, setNewName] = useState(name)
  const nameConflict = newName !== name && takenNames.includes(newName)
  const nameBlank = !newName.trim()
  const { error, pending, onSubmit } = useIpcAction(async () => {
    if (nameBlank) {
      throw new Error(`The ${noun} name cannot be empty`)
    }
    if (nameConflict) {
      throw new Error(`A ${noun} with this name already exists`)
    }
    await rename(newName)
  }, onClose)

  return (
    <ConfirmDialog
      open
      maxWidth="xs"
      fullWidth
      title={`Rename ${noun}`}
      submitDisabled={pending || nameBlank}
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>
        Please enter a new name for the {noun}:
      </DialogContentText>
      {nameConflict ? (
        <DialogContentText color="error">
          There is already a {noun} named &quot;{newName}&quot;
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
})

export default RenameDialog
