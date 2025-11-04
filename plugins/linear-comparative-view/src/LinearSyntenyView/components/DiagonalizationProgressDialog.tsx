import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  LinearProgress,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../model'

const DiagonalizationProgressDialog = observer(function ({
  handleClose,
  model,
}: {
  handleClose: () => void
  model: LinearSyntenyViewModel
}) {
  const { diagonalizationProgress: progress, diagonalizationMessage: message } =
    model

  return (
    <Dialog open title="Diagonalizing" onClose={handleClose}>
      <DialogContent style={{ minWidth: 400 }}>
        <Typography variant="body1" gutterBottom>
          {message}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          style={{ marginTop: 16 }}
        />
        <Typography
          variant="caption"
          color="textSecondary"
          style={{ marginTop: 8, display: 'block' }}
        >
          {Math.round(progress)}% complete
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" disabled={progress < 100}>
          {progress < 100 ? 'Processing...' : 'Done'}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default DiagonalizationProgressDialog
