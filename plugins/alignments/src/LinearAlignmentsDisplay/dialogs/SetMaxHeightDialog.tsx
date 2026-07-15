import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetMaxHeightDialog = observer(function SetMaxHeightDialog(props: {
  model: {
    setMaxHeight: (arg?: number) => void
    maxHeight: number
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [maxHeight, setMaxHeight] = useState<number | undefined>(
    model.maxHeight,
  )
  const ok = maxHeight !== undefined

  return (
    <SubmitDialog
      open
      title="Set max layout height"
      submitDisabled={!ok}
      onCancel={handleClose}
      onSubmit={() => {
        model.setMaxHeight(maxHeight)
        handleClose()
      }}
    >
      <Typography>
        Maximum pixel height of the pileup layout. Reads that pile up beyond
        this are not stacked; the coverage histogram still reflects the true
        depth. Raise it for very deep targeted-sequencing data.
      </Typography>
      <NumberTextField
        defaultValue={model.maxHeight}
        onValueChange={setMaxHeight}
        label="Max layout height (px)"
        autoFocus
        min={1}
        errorText="Must be a positive number"
      />
    </SubmitDialog>
  )
})

export default SetMaxHeightDialog
