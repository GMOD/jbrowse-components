import { ConfirmDialog } from '@jbrowse/core/ui'
import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const DeleteConnectionDialog = observer(function DeleteConnectionDialog({
  deleteDialogDetails,
  session,
  handleClose,
}: {
  deleteDialogDetails: {
    name: string
    connectionConf: AnyConfigurationModel
  }
  session: AbstractSessionModel
  handleClose: () => void
}) {
  const { connectionConf, name } = deleteDialogDetails
  return (
    <ConfirmDialog
      open
      title={`Delete connection "${name}"`}
      onCancel={handleClose}
      onSubmit={() => {
        session.deleteConnection?.(connectionConf)
        handleClose()
      }}
    >
      <DialogContentText>
        This will remove the connection and all of its tracks from the session.
        The underlying data source will not be modified.
      </DialogContentText>
    </ConfirmDialog>
  )
})

export default DeleteConnectionDialog
