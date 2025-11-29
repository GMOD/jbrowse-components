import { DialogContent } from '@mui/material'

import Dialog from './Dialog'

export default function CascadingMenuHelpDialog({
  onClose,
  helpText,
  label,
}: {
  onClose: (event: React.MouseEvent | React.KeyboardEvent) => void
  helpText: React.ReactNode
  label?: string
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={label ? `Help: ${label}` : 'Help'}
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <DialogContent>{helpText}</DialogContent>
    </Dialog>
  )
}
