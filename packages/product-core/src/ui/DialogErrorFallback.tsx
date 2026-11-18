import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

const DialogErrorFallback = observer(function DialogErrorFallback({
  error,
  onClose,
}: {
  error: unknown
  onClose: () => void
}) {
  return (
    <Dialog open title="Error" onClose={onClose}>
      <DialogContent>
        <ErrorMessage error={error} />
      </DialogContent>
    </Dialog>
  )
})

export default DialogErrorFallback
