import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetRowHeightDialog = observer(function (props: {
  model: {
    rowHeight?: number
    rowProportion?: number
    setRowHeight: (arg: number) => void
    setRowProportion: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [rowHeight, setRowHeight] = useState<number | undefined>(model.rowHeight)
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
        defaultValue={model.rowHeight}
        helperText="Enter row height"
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
