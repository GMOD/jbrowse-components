import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { parseBpString, toLocale } from '@jbrowse/core/util'
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
  const bp = parseBpString(val)
  const valid = bp !== undefined && bp > 0

  return (
    <SubmitDialog
      open
      maxWidth="xs"
      fullWidth
      title="Edit zoom level"
      onCancel={handleClose}
      submitDisabled={!valid}
      onSubmit={() => {
        if (valid) {
          model.zoomTo(bp / model.width)
        }
        handleClose()
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Typography>
          Enter a specific number of base pairs to change the viewport to show,
          either in full or abbreviated as e.g. 500kb or 1.5Mb. This is
          approximate and does not account for padding between regions or
          off-screen scrolling
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
