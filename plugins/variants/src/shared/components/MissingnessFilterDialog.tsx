import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

export default function MissingnessFilterDialog({
  model,
  handleClose,
}: {
  model: {
    maxMissingnessFilter?: number
    setMaxMissingnessFilter: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { maxMissingnessFilter = 1 } = model
  const [missingness, setMissingness] = useState<number | undefined>(
    maxMissingnessFilter,
  )

  return (
    <SubmitDialog
      open
      title="Set missingness filter"
      onCancel={handleClose}
      submitDisabled={missingness === undefined}
      onSubmit={() => {
        if (missingness !== undefined) {
          model.setMaxMissingnessFilter(missingness)
          handleClose()
        }
      }}
    >
      <Typography>
        Hide variants where the fraction of no-call (missing) genotypes is above
        this threshold — useful for clearing out the sparse sites that clutter a
        multi-sample matrix. Valid range: 0 to 1 (1 keeps every variant).
      </Typography>
      <NumberTextField
        defaultValue={maxMissingnessFilter}
        autoFocus
        fullWidth
        margin="normal"
        label="Max missingness threshold"
        placeholder="Enter max missingness (0-1)"
        min={0}
        max={1}
        errorText="Missingness must be between 0 and 1"
        onValueChange={setMissingness}
      />
    </SubmitDialog>
  )
}
