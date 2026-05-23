import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'

function format(n: number) {
  return toLocale(Math.floor(n))
}

const RegionWidthEditorDialog = observer(function RegionWidthEditorDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const { bpPerPx, width } = model
  const [val, setVal] = useState(format(bpPerPx * width))
  const val2 = val.replace(/,/g, '')

  return (
    <SubmitDialog
      open
      title="Edit zoom level"
      onCancel={handleClose}
      onSubmit={() => {
        model.zoomTo(+val2 / model.width)
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
          value={val}
          onChange={event => {
            setVal(event.target.value)
          }}
        />
      </div>
    </SubmitDialog>
  )
})

export default RegionWidthEditorDialog
