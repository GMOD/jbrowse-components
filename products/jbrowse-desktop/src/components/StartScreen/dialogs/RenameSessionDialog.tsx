import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, Input } from '@mui/material'
const { ipcRenderer } = window.require('electron')

const RenameSessionDialog = ({
  sessionToRename,
  onClose,
}: {
  sessionToRename?: { path: string; name: string }
  onClose: () => void
}) => {
  const [newSessionName, setNewSessionName] = useState(
    sessionToRename?.name ?? '',
  )
  const [error, setError] = useState<unknown>()

  return (
    <ConfirmDialog
      open
      onCancel={onClose}
      onSubmit={async () => {
        try {
          await ipcRenderer.invoke(
            'renameSession',
            sessionToRename?.path,
            newSessionName,
          )
          onClose()
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
        value={newSessionName}
        onChange={event => {
          setNewSessionName(event.target.value)
        }}
      />
      {error ? <ErrorBanner error={error} /> : null}
    </ConfirmDialog>
  )
}

export default RenameSessionDialog
