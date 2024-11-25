import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import {
  Alert,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type {
  GridBookmarkModel,
  IExtendedLabeledRegionModel,
} from '../../model'

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
          variant="outlined"
          value={newLabel}
          onChange={e => {
            setNewLabel(e.target.value)
          }}
          autoFocus
          slotProps={{
            htmlInput: { 'data-testid': 'edit-bookmark-label-field' },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (newLabel) {
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
