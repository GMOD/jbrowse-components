import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { TextField, Typography } from '@mui/material'

import type { LinearGenomeViewModel } from '../model.ts'

function format(n: number) {
  return toLocale(Math.floor(n))
}

// not an observer: the initial value is seeded once and the field is
// user-edited thereafter, so it shouldn't reactively reset if bpPerPx changes
export default function RegionWidthEditorDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const [val, setVal] = useState(() => format(model.bpPerPx * model.width))
  const bp = +val.replaceAll(',', '')
  const valid = Number.isFinite(bp) && bp > 0

  return (
    <SubmitDialog
      open
      maxWidth="xs"
      fullWidth
      title="Edit zoom level"
      onCancel={handleClose}
      submitDisabled={!valid}
      onSubmit={() => {
        model.zoomTo(bp / model.width)
        handleClose()
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Typography>
          Enter a specific number of base pairs to change the viewport to show.
          This is approximate and does not account for padding between regions
          or off-screen scrolling
        </Typography>
        <TextField
          label="Zoom level (bp)"
          autoFocus
          fullWidth
          variant="outlined"
          value={val}
          onChange={event => {
            setVal(event.target.value)
          }}
        />
      </div>
    </SubmitDialog>
  )
}
