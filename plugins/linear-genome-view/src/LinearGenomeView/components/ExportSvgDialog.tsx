import {
  BaseExportSvgDialog,
  LabeledCheckbox,
  useExportSvgPreference,
} from '@jbrowse/core/ui'
import { MenuItem, TextField } from '@mui/material'

import type { TrackLabelMode } from '../types.ts'
import type { BaseExportSvgOptions } from '@jbrowse/core/ui'

// The export mode matching a view's on-screen label setting, for a user who
// has not picked one in this dialog before.
function labelModeFor(viewTrackLabels: string | undefined): TrackLabelMode {
  return viewTrackLabels === 'hidden'
    ? 'none'
    : viewTrackLabels === 'overlapping'
      ? 'overlay'
      : 'offset'
}

// Shared track-label + gridlines export dialog. Used by LGV, linear-synteny and
// breakpoint-split views (their lazyDialogs re-export this).
export default function ExportSvgDialog({
  model,
  handleClose,
}: {
  model: {
    effectiveTrackLabels?: string
    exportSvg(
      opts: BaseExportSvgOptions & {
        trackLabels: TrackLabelMode
        showGridlines: boolean
      },
    ): Promise<unknown>
  }
  handleClose: () => void
}) {
  const [trackLabels, setTrackLabels] = useExportSvgPreference<TrackLabelMode>(
    'tracklabels',
    labelModeFor(model.effectiveTrackLabels),
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
        <MenuItem value="overlay">Overlay</MenuItem>
        <MenuItem value="left">Left</MenuItem>
        <MenuItem value="none">None</MenuItem>
      </TextField>
    </BaseExportSvgDialog>
  )
}
