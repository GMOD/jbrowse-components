import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import ConfirmDialog from './ConfirmDialog.tsx'

const ReturnToImportFormDialog = observer(function ReturnToImportFormDialog({
  model,
  handleClose,
}: {
  model: { clearView: () => void }
  handleClose: () => void
}) {
  return (
    <ConfirmDialog
      open
      title="Return to import form?"
      onCancel={handleClose}
      onSubmit={() => {
        model.clearView()
        handleClose()
      }}
    >
      <DialogContentText>
        Are you sure you want to return to the import form? This will lose your
        current view.
      </DialogContentText>
    </ConfirmDialog>
  )
})

export default ReturnToImportFormDialog
