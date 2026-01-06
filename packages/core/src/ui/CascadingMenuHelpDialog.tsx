import { DialogContent } from '@mui/material'

import Dialog from './Dialog.tsx'

export default function CascadingMenuHelpDialog({
  onClose,
  helpText,
  label,
}: {
  onClose: (event: React.MouseEvent | React.KeyboardEvent) => void
  helpText: React.ReactNode
  label?: React.ReactNode
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Help"
      titleNode={label ? <>Help: {label}</> : undefined}
      onClick={e => {
        e.stopPropagation()
      }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
    >
      <DialogContent>{helpText}</DialogContent>
    </Dialog>
  )
}
