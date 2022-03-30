import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { AbstractSessionModel } from '@jbrowse/core/util'

function DeleteConnectionDialog({
  deleteDialogDetails,
  session,
  handleClose,
}: {
  deleteDialogDetails: { name: string; connectionConf: AnyConfigurationModel }
  session: AbstractSessionModel
  handleClose: Function
}) {
  const { connectionConf, name } = deleteDialogDetails
  return (
    <Dialog open>
      <DialogTitle>Delete connection &quot;{name}&quot;</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete this connection?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()} color="primary">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (connectionConf) {
              session.deleteConnection?.(connectionConf)
            }
            handleClose()
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(DeleteConnectionDialog)
