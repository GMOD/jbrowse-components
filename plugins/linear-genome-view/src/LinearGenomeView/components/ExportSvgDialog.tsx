import { BaseExportSvgDialog, useExportSvgPreference } from '@jbrowse/core/ui'
import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'

import type { TrackLabelMode } from '../types.ts'
import type { BaseExportSvgOptions } from '@jbrowse/core/ui'

// Shared track-label + gridlines export dialog. Used by LGV, linear-synteny and
// breakpoint-split views (their lazyDialogs re-export this).
export default function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: {
    exportSvg(
      opts: BaseExportSvgOptions & {
        trackLabels: TrackLabelMode
        showGridlines: boolean
      },
    ): Promise<void>
  }
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
        style={{ minWidth: 200 }}
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
