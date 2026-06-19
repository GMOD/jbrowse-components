import { BaseExportSvgDialog, useExportSvgPreference } from '@jbrowse/core/ui'
import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'

import type { ExportSvgOptions } from '../types.ts'
import type { TrackLabelMode } from '@jbrowse/plugin-linear-genome-view'

export default function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: { exportSvg(opts: ExportSvgOptions): Promise<void> }
  handleClose: () => void
}) {
  const [trackLabels, setTrackLabels] = useExportSvgPreference<TrackLabelMode>(
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
      checkboxes={
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
      }
    >
      <TextField
        select
        label="Track label positioning"
        variant="outlined"
        sx={{ width: 150 }}
        value={trackLabels}
        onChange={event => {
          setTrackLabels(event.target.value as TrackLabelMode)
        }}
      >
        <MenuItem value="offset">Offset</MenuItem>
        <MenuItem value="overlay">Overlay</MenuItem>
        <MenuItem value="left">Left</MenuItem>
        <MenuItem value="none">None</MenuItem>
      </TextField>
    </BaseExportSvgDialog>
  )
}
