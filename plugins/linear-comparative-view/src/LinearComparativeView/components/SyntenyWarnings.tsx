import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import ReportProblemIcon from '@mui/icons-material/ReportProblemOutlined'
import { Alert, DialogContent, IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const SyntenyWarnings = observer(function SyntenyWarnings({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const [open, setOpen] = useState(false)
  const warnings = model.levels
    .flatMap(level => level.linearSyntenyDisplays)
    .flatMap(display => display.warnings)

  return warnings.length ? (
    <>
      <Tooltip
        title={`${warnings.length} synteny warning${warnings.length > 1 ? 's' : ''} — click for details`}
      >
        <IconButton
          color="warning"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            setOpen(true)
          }}
        >
          <ReportProblemIcon />
        </IconButton>
      </Tooltip>
      {open ? (
        <Dialog
          open
          title="Synteny warnings"
          onClose={() => {
            setOpen(false)
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
      ) : null}
    </>
  ) : null
})

export default SyntenyWarnings
