import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'

import { invokeIpc } from '../../../ipc.ts'
import { useIpcAction } from './useIpcAction.ts'

export default function DeleteQuickstartDialog({
  quickstartToDelete,
  onClose,
}: {
  quickstartToDelete: string
  onClose: () => void
}) {
  const { error, pending, onSubmit } = useIpcAction(
    () => invokeIpc('deleteQuickstart', quickstartToDelete),
    onClose,
  )
  return (
    <ConfirmDialog
      open
      title={`Delete "${quickstartToDelete}"?`}
      submitDisabled={pending}
      onSubmit={onSubmit}
      onCancel={onClose}
    >
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
