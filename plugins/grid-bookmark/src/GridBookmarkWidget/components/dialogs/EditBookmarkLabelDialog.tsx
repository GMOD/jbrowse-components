import React, { useState } from 'react'
import {
  Alert,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { assembleLocString } from '@jbrowse/core/util'

import { GridBookmarkModel, IExtendedLabeledRegionModel } from '../../model'

const EditBookmarkLabelDialog = observer(function ({
  model,
  onClose,
  dialogRow,
}: {
  model: GridBookmarkModel
  dialogRow: IExtendedLabeledRegionModel
  onClose: () => void
}) {
  const [newLabel, setNewLabel] = useState(dialogRow.label || '')
  return (
    <Dialog open onClose={onClose} title="Edit bookmark label">
      <DialogContent>
        <Alert>
          Editing label for bookmark{' '}
          <strong>{assembleLocString(dialogRow.correspondingObj)}</strong>:
        </Alert>
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'edit-bookmark-label-field' }}
          variant="outlined"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (newLabel && dialogRow) {
              model.updateBookmarkLabel(dialogRow, newLabel)
            }
            setNewLabel('')
            onClose()
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default EditBookmarkLabelDialog
