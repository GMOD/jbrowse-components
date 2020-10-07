import React from 'react'
import { getConf } from '@gmod/jbrowse-core/configuration'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'

export default function ColorByTagDlg({
  model,
  handleClose,
}: {
  model: any
  handleClose: () => void
}) {
  const trackName = getConf(model, 'name')
  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{trackName}</DialogTitle>
      <DialogContent />
    </Dialog>
  )
}
