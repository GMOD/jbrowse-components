import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'
import {
  Button,
  DialogContent,
  DialogActions,
  Alert,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

// locals
import type { GridBookmarkModel } from '../../model'

const EditHighlightColorDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { selectedBookmarks } = model
  const editNone = selectedBookmarks.length === 0
  const [color, setColor] = useState(
    selectedBookmarks[0]?.highlight ?? 'rgba(247, 129, 192, 0.35)',
  )

  return (
    <Dialog open onClose={onClose} title="Highlight bookmarks">
      <DialogContent>
        <Typography variant="h6">Bulk highlight selector</Typography>
        <Alert severity="info">
          {editNone ? (
            <span>
              Use the checkboxes to select individual bookmarks to edit.
            </span>
          ) : (
            'Only selected bookmarks will be edited.'
          )}
        </Alert>
        {!editNone ? (
          <ColorPicker
            color={color}
            onChange={event => {
              setColor(event)
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            model.updateBulkBookmarkHighlights(color)
            onClose()
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default EditHighlightColorDialog
