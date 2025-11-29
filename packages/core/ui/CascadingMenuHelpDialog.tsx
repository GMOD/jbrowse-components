import { DialogContent } from '@mui/material'

import Dialog from './Dialog'

export default function CascadingMenuHelpDialog({
  onClose,
  helpText,
}: {
  onClose: (event: React.MouseEvent | React.KeyboardEvent) => void
  helpText: React.ReactNode
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Help"
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <DialogContent>{helpText}</DialogContent>
    </Dialog>
  )
}
