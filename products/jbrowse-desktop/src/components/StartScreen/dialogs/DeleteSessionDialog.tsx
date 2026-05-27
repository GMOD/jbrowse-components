import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'

import { useIpcAction } from './useIpcAction.ts'

const { ipcRenderer } = window.require('electron')

export default function DeleteSessionDialog({
  sessionsToDelete,
  onClose,
}: {
  sessionsToDelete: { path: string }[]
  onClose: () => void
}) {
  const count = sessionsToDelete.length
  const { error, onSubmit } = useIpcAction(
    () =>
      ipcRenderer.invoke(
        'deleteSessions',
        sessionsToDelete.map(s => s.path),
      ),
    onClose,
  )
  return (
    <ConfirmDialog
      open
      title={`Delete ${count} ${count === 1 ? 'session' : 'sessions'}?`}
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
