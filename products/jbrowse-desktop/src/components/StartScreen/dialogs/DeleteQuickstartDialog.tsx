import { useState } from 'react'

import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, Typography } from '@mui/material'
const { ipcRenderer } = window.require('electron')

const DeleteSessionDialog = ({
  quickstartToDelete,
  onClose,
}: {
  quickstartToDelete: string
  onClose: (arg0: boolean) => void
}) => {
  const [error, setError] = useState<unknown>()
  return (
    <ConfirmDialog
      open
      title={`Delete "${quickstartToDelete}"?`}
      onCancel={() => {
        onClose(false)
      }}
      onSubmit={async () => {
        try {
          await ipcRenderer.invoke('deleteQuickstart', quickstartToDelete)
          onClose(true)
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
    >
      <DialogContentText>This action cannot be undone</DialogContentText>
      {error ? <Typography color="error">{`${error}`}</Typography> : null}
    </ConfirmDialog>
  )
}

export default DeleteSessionDialog
