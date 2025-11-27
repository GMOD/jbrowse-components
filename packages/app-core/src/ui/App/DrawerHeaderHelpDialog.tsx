import { DialogContent } from '@mui/material'

import Dialog from '@jbrowse/core/ui/Dialog'

export default function DrawerHeaderHelpDialog({
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
