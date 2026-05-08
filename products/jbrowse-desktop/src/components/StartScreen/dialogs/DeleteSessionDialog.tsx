import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'
const { ipcRenderer } = window.require('electron')

const DeleteSessionDialog = ({
  sessionsToDelete,
  onClose,
}: {
  sessionsToDelete: { path: string }[]
  onClose: () => void
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <ConfirmDialog
      open
      title={`Delete ${sessionsToDelete.length} sessions?`}
      onSubmit={async () => {
        try {
          await ipcRenderer.invoke(
            'deleteSessions',
            sessionsToDelete.map(s => s.path),
          )
          onClose()
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
      onCancel={onClose}
    >
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}

export default DeleteSessionDialog
