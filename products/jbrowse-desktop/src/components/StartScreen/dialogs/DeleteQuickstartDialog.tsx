import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'

import { useIpcAction } from './useIpcAction.ts'

const { ipcRenderer } = window.require('electron')

export default function DeleteQuickstartDialog({
  quickstartToDelete,
  onClose,
}: {
  quickstartToDelete: string
  onClose: () => void
}) {
  const { error, onSubmit } = useIpcAction(
    () => ipcRenderer.invoke('deleteQuickstart', quickstartToDelete),
    onClose,
  )
  return (
    <ConfirmDialog
      open
      title={`Delete "${quickstartToDelete}"?`}
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
