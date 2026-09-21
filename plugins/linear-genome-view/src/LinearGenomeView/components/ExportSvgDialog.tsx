import {
  BaseExportSvgDialog,
  LabeledCheckbox,
  useExportSvgPreference,
} from '@jbrowse/core/ui'
import { MenuItem, TextField } from '@mui/material'

import type { TrackLabelMode, ViewTrackLabelMode } from '../types.ts'
import type { BaseExportSvgOptions } from '@jbrowse/core/ui'

// Shared track-label + gridlines export dialog. Used by LGV, linear-synteny and
// breakpoint-split views (their lazyDialogs re-export this).
export default function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: {
    effectiveTrackLabels?: ViewTrackLabelMode
    exportSvg(
      opts: BaseExportSvgOptions & {
        trackLabels: TrackLabelMode
        showGridlines: boolean
      },
    ): Promise<unknown>
  }
  handleClose: () => void
}) {
  // The view's own setting is already an export mode, so a user who has not
  // picked one here gets the figure their screen shows. The key is `-mode`
  // because the modes were once spelled `overlay`/`none`, and a stored one of
  // those would select nothing in the dropdown.
  const [trackLabels, setTrackLabels] = useExportSvgPreference<TrackLabelMode>(
    'tracklabels-mode',
    model.effectiveTrackLabels ?? 'offset',
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
        <LabeledCheckbox
          checked={showGridlines}
          onChange={val => {
            setShowGridlines(val)
          }}
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
        <MenuItem value="overlapping">Overlapping</MenuItem>
        <MenuItem value="left">Left</MenuItem>
        <MenuItem value="hidden">Hidden</MenuItem>
      </TextField>
    </BaseExportSvgDialog>
  )
}
