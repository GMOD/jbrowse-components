import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, Input } from '@mui/material'
const { ipcRenderer } = window.require('electron')

const RenameQuickstartDialog = ({
  quickstartNames,
  quickstartToRename,
  onClose,
}: {
  quickstartNames: string[]
  quickstartToRename?: string
  onClose: (arg0: boolean) => void
}) => {
  const [newQuickstartName, setNewQuickstartName] = useState('')
  const [error, setError] = useState<unknown>()

  return (
    <ConfirmDialog
      open
      title="Rename quickstart"
      onCancel={() => {
        onClose(false)
      }}
      onSubmit={async () => {
        try {
          if (quickstartNames.includes(newQuickstartName)) {
            throw new Error('quickstart with this name already exists')
          }
          await ipcRenderer.invoke(
            'renameQuickstart',
            quickstartToRename,
            newQuickstartName,
          )
          onClose(true)
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
    >
      <DialogContentText>
        Please enter a new name for the session:
      </DialogContentText>
      {quickstartNames.includes(newQuickstartName) ? (
        <DialogContentText color="error">
          There is already a session named &quot;{newQuickstartName}&quot;
        </DialogContentText>
      ) : null}
      <Input
        autoFocus
        defaultValue={quickstartToRename}
        onChange={event => {
          setNewQuickstartName(event.target.value)
        }}
      />
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}

export default RenameQuickstartDialog
