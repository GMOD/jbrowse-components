import React from 'react'
import {
  Typography,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { GridBookmarkModel, IExtendedLabeledRegionModel } from '../model'
import { observer } from 'mobx-react'

const EditBookmarkLabelDialog = observer(function ({
  model,
  onClose,
  dialogRow,
  newLabel,
  bookmarkRows,
  setNewLabel,
}: {
  bookmarkRows: IExtendedLabeledRegionModel[]
  model: GridBookmarkModel
  newLabel?: string
  setNewLabel: (arg: string) => void
  dialogRow?: IExtendedLabeledRegionModel
  onClose: () => void
}) {
  return (
    <Dialog open onClose={onClose} title="Edit bookmark label">
      <DialogContent>
        <Typography>
          Editing label for bookmark{' '}
          <strong>
            {dialogRow?.refName}:{dialogRow?.start}..{dialogRow?.end}
          </strong>
          :
        </Typography>
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'edit-bookmark-label-field' }}
          variant="outlined"
          value={newLabel ?? dialogRow?.label}
          onChange={e => setNewLabel(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (newLabel && dialogRow) {
              const target = bookmarkRows[dialogRow.id]
              model.updateBookmarkLabel(target, newLabel)
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
