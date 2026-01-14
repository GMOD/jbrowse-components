import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'

export default function FilterArcsByScoreDialog({
  model,
  handleClose,
}: {
  model: {
    minArcScore: number
    setMinArcScore: (arg: number) => void
  }
  handleClose: () => void
}) {
  const [minScore, setMinScore] = useState(`${model.minArcScore}`)

  return (
    <Dialog
      open
      maxWidth="md"
      onClose={handleClose}
      title="Filter arcs by score"
    >
      <DialogContent style={{ width: '40em' }}>
        <Typography gutterBottom>
          Filter out arcs with fewer than N reads of support. Set to 0 to show
          all arcs.
        </Typography>
        <TextField
          label="Minimum read support"
          type="number"
          value={minScore}
          onChange={event => {
            setMinScore(event.target.value)
          }}
          slotProps={{
            htmlInput: { min: 0 },
          }}
          fullWidth
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            const val = Number.parseInt(minScore, 10)
            model.setMinArcScore(Number.isNaN(val) ? 0 : Math.max(0, val))
            handleClose()
          }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
}
