import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

export default function MAFFilterDialog({
  model,
  handleClose,
}: {
  model: {
    minorAlleleFrequencyFilter?: number
    setMafFilter: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { minorAlleleFrequencyFilter = 0 } = model
  const [maf, setMaf] = useState<number | undefined>(minorAlleleFrequencyFilter)

  return (
    <SubmitDialog
      open
      title="Set minor allele frequency (MAF) filter"
      onCancel={handleClose}
      submitDisabled={maf === undefined}
      onSubmit={() => {
        if (maf !== undefined) {
          model.setMafFilter(maf)
          handleClose()
        }
      }}
    >
      <Typography>
        Filter out variants with minor allele frequency below this threshold.
        Valid range: 0 to 0.5
      </Typography>
      <NumberTextField
        defaultValue={minorAlleleFrequencyFilter}
        autoFocus
        fullWidth
        margin="normal"
        label="MAF threshold"
        placeholder="Enter MAF (0-0.5)"
        min={0}
        max={0.5}
        errorText="MAF must be between 0 and 0.5"
        onValueChange={setMaf}
      />
    </SubmitDialog>
  )
}
