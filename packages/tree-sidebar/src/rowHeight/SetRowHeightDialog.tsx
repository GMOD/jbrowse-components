import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { FIT_ROWS } from '@jbrowse/core/util/resolveRowHeight'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { RowHeightModel } from './rowHeightMenu.ts'

/**
 * The "Custom..." row-height entry every multi-row display offers: a px
 * height, fit being the radio beside it. It seeds from `rowStep`, never
 * `effectiveRowHeight`: in fit mode the resolved getter returns the computed
 * fractional height, so seeding from it and submitting silently pinned that
 * number and left fit mode, which the variants copy of this dialog did. In fit
 * mode the field starts empty, and left empty keeps fit, so a display with a
 * proportion can change that alone.
 *
 * `rowProportion` is the per-consumer opt-out: a display whose glyphs occupy
 * part of the row band exposes the pair and gets a second field, and one whose
 * rows fill their band answers `undefined` or exposes neither and gets one.
 */
const SetRowHeightDialog = observer(function SetRowHeightDialog({
  model,
  handleClose,
}: {
  model: RowHeightModel
  handleClose: () => void
}) {
  const { rowProportion, setRowProportion } = model
  const proportionApplies =
    rowProportion !== undefined && setRowProportion !== undefined
  const pinned = model.rowStep === FIT_ROWS ? undefined : model.rowStep
  const [height, setHeight] = useState(pinned)
  const [heightEmpty, setHeightEmpty] = useState(pinned === undefined)
  const [proportion, setProportion] = useState<number | undefined>(
    rowProportion,
  )

  return (
    <SubmitDialog
      open
      title="Custom row height"
      onCancel={handleClose}
      submitDisabled={
        (heightEmpty
          ? !proportionApplies
          : height === undefined || height <= 0) ||
        (proportionApplies && proportion === undefined)
      }
      onSubmit={() => {
        if (height !== undefined) {
          model.setRowHeight(height)
        }
        if (setRowProportion && proportion !== undefined) {
          setRowProportion(proportion)
        }
        handleClose()
      }}
    >
      {proportionApplies ? (
        <Typography>
          Set row height and the proportion of the row height to use for drawing
          each row
        </Typography>
      ) : null}
      <NumberTextField
        defaultValue={pinned}
        helperText={
          pinned === undefined
            ? 'Enter row height in px, or leave it empty to keep fitting the track height'
            : 'Enter row height in px'
        }
        min={0}
        autoFocus
        onValueChange={(value, text) => {
          setHeight(value)
          setHeightEmpty(text === '')
        }}
      />
      {proportionApplies ? (
        <NumberTextField
          defaultValue={rowProportion}
          helperText="Enter row proportion, 0 to 1"
          min={0}
          max={1}
          onValueChange={setProportion}
        />
      ) : null}
    </SubmitDialog>
  )
})

export default SetRowHeightDialog
