import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ColorBy } from '../../shared/types.ts'

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
    const [threshold, setThreshold] = useState<number | undefined>(
      model.modificationThreshold,
    )

    return (
      <SubmitDialog
        open
        title="Adjust modification threshold"
        submitDisabled={threshold === undefined}
        onCancel={handleClose}
        onSubmit={() => {
          if (threshold !== undefined) {
            const currentColorBy = model.colorBy ?? { type: 'modifications' }
            model.setColorScheme({
              ...currentColorBy,
              modifications: {
                ...currentColorBy.modifications,
                threshold,
              },
            })
          }
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
        <NumberTextField
          defaultValue={model.modificationThreshold}
          onValueChange={setThreshold}
          label="Threshold (0-100)"
          autoFocus
          min={0}
          max={100}
          errorText="Must be a number between 0 and 100"
        />
      </SubmitDialog>
    )
  },
)

export default SetModificationThresholdDialog
