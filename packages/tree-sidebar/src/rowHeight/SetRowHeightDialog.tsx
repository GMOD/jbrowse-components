import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { RowHeightModel } from './rowHeightMenu.ts'

/**
 * The "Custom..." row-height entry every multi-row display offers.
 *
 * Two rules that are easy to get wrong individually and were, so they live here
 * once:
 *
 * - **Seed from the raw `rowHeight` property, never `effectiveRowHeight`.** In
 *   fit mode the resolved getter returns the computed fractional height, so
 *   seeding from it and submitting silently pins that number and leaves fit
 *   mode. That is what the variants copy of this dialog did.
 * - **`0` submits through `setFitToHeight()`, not `setRowHeight(0)`.** The
 *   sentinel is advertised in the helper text, and the fit height comes off the
 *   `height` slot, which `setRowHeight` leaves at a stale earlier value — so
 *   writing it raw made the track jump on submit.
 *
 * `rowProportion` is the per-consumer opt-out: a display whose glyphs occupy
 * only part of the row band (maf) exposes the pair and gets a second field, and
 * one whose rows fill their band (multi-row features, variants) exposes neither
 * and gets one. The optional pair is what kept this from being shared before.
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
  const [height, setHeight] = useState<number | undefined>(model.rowHeight)
  const [proportion, setProportion] = useState<number | undefined>(
    rowProportion,
  )

  return (
    <SubmitDialog
      open
      title="Custom row height"
      onCancel={handleClose}
      submitDisabled={
        height === undefined || (proportionApplies && proportion === undefined)
      }
      onSubmit={() => {
        if (height === undefined) {
          return
        }
        if (height === 0) {
          model.setFitToHeight()
        } else {
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
        defaultValue={model.rowHeight}
        helperText="Enter row height in px (0 = squeeze to fit view)"
        autoFocus
        onValueChange={setHeight}
      />
      {proportionApplies ? (
        <NumberTextField
          defaultValue={rowProportion}
          helperText="Enter row proportion"
          onValueChange={setProportion}
        />
      ) : null}
    </SubmitDialog>
  )
})

export default SetRowHeightDialog
