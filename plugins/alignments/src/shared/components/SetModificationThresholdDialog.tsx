import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ColorBy } from '../types.ts'

const SetModificationThresholdDialog = observer(
  function SetModificationThresholdDialog(props: {
    model: {
      modificationThreshold: number
      colorBy?: ColorBy
      setColorScheme: (colorBy: ColorBy) => void
    }
    handleClose: () => void
  }) {
    const { model, handleClose } = props
    const [threshold, setThreshold] = useState(
      String(model.modificationThreshold),
    )
    const numThreshold = Number.parseFloat(threshold)
    const validThreshold =
      !Number.isNaN(numThreshold) && numThreshold >= 0 && numThreshold <= 100

    return (
      <SubmitDialog
        open
        title="Adjust modification threshold"
        submitDisabled={!validThreshold}
        onCancel={handleClose}
        onSubmit={() => {
          const currentColorBy = model.colorBy ?? { type: 'modifications' }
          model.setColorScheme({
            ...currentColorBy,
            modifications: {
              ...currentColorBy.modifications,
              threshold: numThreshold,
            },
          })
          handleClose()
        }}
      >
        <Typography>
          Set the minimum probability threshold for displaying modifications
        </Typography>
        <Typography color="text.secondary">
          Only modifications with probability above this threshold will be
          displayed (0-100%)
        </Typography>
        <TextField
          value={threshold}
          autoFocus
          onChange={event => {
            setThreshold(event.target.value)
          }}
          label="Threshold (0-100)"
          error={threshold !== '' && !validThreshold}
          helperText={
            threshold !== '' && !validThreshold
              ? 'Must be a number between 0 and 100'
              : ''
          }
          autoComplete="off"
          type="number"
          slotProps={{
            htmlInput: {
              min: 0,
              max: 100,
              step: 1,
            },
          }}
        />
      </SubmitDialog>
    )
  },
)

export default SetModificationThresholdDialog
