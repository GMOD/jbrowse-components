import { Dialog } from '@jbrowse/core/ui'
import { Alert, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const SyntenyWarningsDialog = observer(function SyntenyWarningsDialog({
  model,
  handleClose,
}: {
  model: LinearComparativeViewModel
  handleClose: () => void
}) {
  const warnings = model.levels
    .flatMap(level => level.linearSyntenyDisplays)
    .flatMap(display => display.warnings)
  return (
    <Dialog
      open
      title="Synteny warnings"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent>
        {warnings.map(w => (
          <Alert key={w.message} severity="warning" style={{ marginBottom: 8 }}>
            <Typography variant="subtitle2">{w.message}</Typography>
            {w.effect}
          </Alert>
        ))}
      </DialogContent>
    </Dialog>
  )
})

export default SyntenyWarningsDialog
