import React from 'react'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

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
    <Dialog open title={`Delete connection "${name}"`}>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete this connection?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            session.deleteConnection?.(connectionConf)
            handleClose()
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default DeleteConnectionDialog
