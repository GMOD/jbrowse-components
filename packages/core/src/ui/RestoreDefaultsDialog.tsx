import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import Dialog from './Dialog.tsx'

import type { Props as DialogComponentProps } from './Dialog.tsx'

export interface RestoreDefaultsDialogProps extends DialogComponentProps {
  onClose: () => void
  onRestoreDefault: () => void
  restoreText?: string
  closeText?: string
}

// A Dialog for settings that apply live as the user edits them (no Submit
// step). The footer pairs a secondary "Restore default" action with a primary
// close — the sibling of SubmitDialog for the apply-immediately case.
const RestoreDefaultsDialog = observer(function RestoreDefaultsDialog(
  props: RestoreDefaultsDialogProps,
) {
  const {
    onClose,
    onRestoreDefault,
    restoreText = 'Restore default',
    closeText = 'Close',
    children,
    ...dialogProps
  } = props
  return (
    <Dialog
      onClose={() => {
        onClose()
      }}
      {...dialogProps}
    >
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onRestoreDefault()
          }}
        >
          {restoreText}
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          {closeText}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default RestoreDefaultsDialog
