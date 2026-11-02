import { useState } from 'react'

import {
  BaseExportSvgDialog,
  LabeledCheckbox,
  useExportSvgPreference,
} from '@jbrowse/core/ui'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackLabelMode, ViewTrackLabelMode } from '../types.ts'
import type { BaseExportSvgOptions } from '@jbrowse/core/ui'

const MIN_WIDTH = 100
const MAX_WIDTH = 10000

const TRACK_LABEL_MODES = [
  { mode: 'offset', label: 'Offset' },
  { mode: 'overlapping', label: 'Overlapping' },
  { mode: 'left', label: 'Left' },
  { mode: 'hidden', label: 'Hidden' },
] as const satisfies readonly { mode: TrackLabelMode; label: string }[]

// Shared track-label + gridlines export dialog. Used by LGV, linear-synteny and
// breakpoint-split views (their lazyDialogs re-export this). Only a caller
// passing `chooseWidth` offers the width field, whose model lays itself out at
// `viewWidth`.
const ExportSvgDialog = observer(function ExportSvgDialog({
  model,
  handleClose,
  chooseWidth,
}: {
  model: {
    width?: number
    effectiveTrackLabels?: ViewTrackLabelMode
    exportSvg(
      opts: BaseExportSvgOptions & {
        trackLabels: TrackLabelMode
        showGridlines: boolean
        viewWidth?: number
      },
    ): Promise<unknown>
  }
  handleClose: () => void
  chooseWidth?: boolean
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
  // not a stored preference: a remembered width would drift from the screen's
  const [widthText, setWidthText] = useState(() =>
    String(Math.round(model.width ?? 0)),
  )
  const typedWidth = Number(widthText)
  const widthValid =
    Number.isInteger(typedWidth) &&
    typedWidth >= MIN_WIDTH &&
    typedWidth <= MAX_WIDTH
  return (
    <BaseExportSvgDialog
      model={model}
      handleClose={handleClose}
      exportSvg={opts =>
        model.exportSvg({
          ...opts,
          trackLabels,
          showGridlines,
          viewWidth: chooseWidth && widthValid ? typedWidth : undefined,
        })
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
          const picked = TRACK_LABEL_MODES.find(
            m => m.mode === event.target.value,
          )
          if (picked) {
            setTrackLabels(picked.mode)
          }
        }}
      >
        {TRACK_LABEL_MODES.map(({ mode, label }) => (
          <MenuItem key={mode} value={mode}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      {chooseWidth ? (
        <TextField
          label="Width (px)"
          variant="outlined"
          type="number"
          value={widthText}
          error={!widthValid}
          helperText={
            widthValid
              ? 'Lays the tracks out as a window this wide would; text keeps its size'
              : `A whole number from ${MIN_WIDTH} to ${MAX_WIDTH}`
          }
          slotProps={{
            htmlInput: { min: MIN_WIDTH, max: MAX_WIDTH, step: 1 },
          }}
          onChange={event => {
            setWidthText(event.target.value)
          }}
        />
      ) : null}
    </BaseExportSvgDialog>
  )
})

export default ExportSvgDialog
