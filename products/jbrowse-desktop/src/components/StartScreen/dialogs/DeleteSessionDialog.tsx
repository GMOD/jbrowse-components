import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText } from '@mui/material'
const { ipcRenderer } = window.require('electron')

const DeleteSessionDialog = ({
  sessionsToDelete,
  onClose,
  setError,
}: {
  sessionsToDelete: { path: string }[]
  onClose: (arg0: boolean) => void
  setError: (e: unknown) => void
}) => {
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
          onClose(true)
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
      onCancel={() => {
        onClose(false)
      }}
    >
      <DialogContentText>This action cannot be undone</DialogContentText>
    </ConfirmDialog>
  )
}

export default DeleteSessionDialog
