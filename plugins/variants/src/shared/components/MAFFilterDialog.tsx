import { useState } from 'react'

import Dialog from '@jbrowse/core/ui/Dialog'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'

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
  const [maf, setMaf] = useState(`${minorAlleleFrequencyFilter}`)
  const [error, setError] = useState<string>()

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Set minor allele frequency (MAF) filter"
    >
      <DialogContent style={{ width: 400 }}>
        <Typography>
          Filter out variants with minor allele frequency below this threshold.
          Valid range: 0 to 0.5
        </Typography>
        <TextField
          value={maf}
          autoFocus
          fullWidth
          margin="normal"
          label="MAF threshold"
          placeholder="Enter MAF (0-0.5)"
          error={!!error}
          helperText={error}
          onChange={event => {
            const val = event.target.value
            setMaf(val)
            const num = Number.parseFloat(val)
            if (Number.isNaN(num)) {
              setError('Please enter a valid number')
            } else if (num < 0 || num > 0.5) {
              setError('MAF must be between 0 and 0.5')
            } else {
              setError(undefined)
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            const val = Number.parseFloat(maf)
            if (!Number.isNaN(val) && val >= 0 && val <= 0.5) {
              model.setMafFilter(val)
              handleClose()
            }
          }}
          color="primary"
          variant="contained"
          disabled={!!error}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
