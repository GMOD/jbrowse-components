import React from 'react'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import Dialog from './Dialog'

const ReturnToImportFormDialog = observer(function ({
  model,
  handleClose,
}: {
  model: { clearView: () => void }
  handleClose: () => void
}) {
  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Reference sequence">
      <DialogContent>
        <Typography>
          Are you sure you want to return to the import form? This will lose
          your current view
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            model.clearView()
            handleClose()
          }}
          variant="contained"
          color="primary"
          autoFocus
        >
          OK
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="secondary"
          variant="contained"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ReturnToImportFormDialog
