import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, Input } from '@mui/material'
const { ipcRenderer } = window.require('electron')

const RenameSessionDialog = ({
  sessionToRename,
  onClose,
}: {
  sessionToRename?: { path: string; name: string }
  onClose: (arg0: boolean) => void
}) => {
  const [newSessionName, setNewSessionName] = useState('')
  const [error, setError] = useState<unknown>()

  return (
    <ConfirmDialog
      open
      onCancel={() => {
        onClose(false)
      }}
      onSubmit={async () => {
        try {
          await ipcRenderer.invoke(
            'renameSession',
            sessionToRename?.path,
            newSessionName,
          )
          onClose(true)
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
      title="Rename session"
    >
      <DialogContentText>
        Please enter a new name for the session:
      </DialogContentText>
      <Input
        autoFocus
        defaultValue={sessionToRename?.name}
        onChange={event => {
          setNewSessionName(event.target.value)
        }}
      />
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}

export default RenameSessionDialog
