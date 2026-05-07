import { BaseExportSvgDialog, useExportSvgPreference } from '@jbrowse/core/ui'
import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'

import type { ExportSvgOptions } from '../types.ts'

export default function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: { exportSvg(opts: ExportSvgOptions): Promise<void> }
  handleClose: () => void
}) {
  const [trackLabels, setTrackLabels] = useExportSvgPreference(
    'tracklabels',
    'offset',
  )
  const [showGridlines, setShowGridlines] = useExportSvgPreference(
    'gridlines',
    false,
  )
  return (
    <BaseExportSvgDialog
      model={model}
      handleClose={handleClose}
      exportSvg={opts =>
        model.exportSvg({ ...opts, trackLabels, showGridlines })
      }
    >
      <div>
        <TextField
          select
          label="Track label positioning"
          variant="outlined"
          style={{ width: 150 }}
          value={trackLabels}
          onChange={event => {
            setTrackLabels(event.target.value)
          }}
        >
          <MenuItem value="offset">Offset</MenuItem>
          <MenuItem value="overlay">Overlay</MenuItem>
          <MenuItem value="left">Left</MenuItem>
          <MenuItem value="none">None</MenuItem>
        </TextField>
      </div>
      <FormControlLabel
        control={
          <Checkbox
            checked={showGridlines}
            onChange={() => {
              setShowGridlines(val => !val)
            }}
          />
        }
        label="Show gridlines"
      />
    </BaseExportSvgDialog>
  )
}
