import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetRowHeightDialog = observer(function (props: {
  model: {
    rowHeightMode?: number
    rowProportion?: number
    setRowHeight: (arg: number) => void
    setRowProportion: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Seed from rowHeightMode (the raw setting: 0 = fit-to-height) rather than
  // the resolved `rowHeight` getter, which in fit mode returns the computed
  // fractional autoRowHeight — submitting that would silently pin it.
  const [rowHeight, setRowHeight] = useState<number | undefined>(
    model.rowHeightMode,
  )
  const [rowProportion, setRowProportion] = useState<number | undefined>(
    model.rowProportion,
  )

  return (
    <SubmitDialog
      open
      title="Set row height"
      onCancel={handleClose}
      submitDisabled={rowHeight === undefined || rowProportion === undefined}
      onSubmit={() => {
        if (rowHeight !== undefined && rowProportion !== undefined) {
          model.setRowHeight(rowHeight)
          model.setRowProportion(rowProportion)
          handleClose()
        }
      }}
    >
      <Typography>
        Set row height and the proportion of the row height to use for drawing
        each row
      </Typography>
      <NumberTextField
        defaultValue={model.rowHeightMode}
        helperText="Enter row height (0 = fit to track height)"
        autoFocus
        onValueChange={setRowHeight}
      />
      <NumberTextField
        defaultValue={model.rowProportion}
        helperText="Enter row proportion"
        onValueChange={setRowProportion}
      />
    </SubmitDialog>
  )
})
export default SetRowHeightDialog
