import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import Dialog from './Dialog.tsx'

import type { Props as DialogComponentProps } from './Dialog.tsx'

// The read-only counterpart to SubmitDialog: content plus a single Close
// action. Dialog on its own has no footer, so every informational dialog was
// hand-rolling this one and picking its own button styling.
const InfoDialog = observer(function InfoDialog(
  props: Omit<DialogComponentProps, 'onClose'> & {
    onClose: () => void
    closeText?: string
    // Extra buttons rendered before Close, for an informational dialog that
    // also offers actions on what it is showing (copy, download, open
    // elsewhere).
    actions?: React.ReactNode
  },
) {
  const {
    onClose,
    closeText = 'Close',
    actions,
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
        {actions}
        <Button
          variant="contained"
          color="primary"
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

export default InfoDialog
