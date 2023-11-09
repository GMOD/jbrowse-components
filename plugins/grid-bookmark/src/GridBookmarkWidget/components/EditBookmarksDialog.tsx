import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogContent,
  DialogActions,
  Alert,
  Stack,
  Typography,
  Switch,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'

// locals
import { GridBookmarkModel } from '../model'

const EditBookmarksDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { selectedBookmarks } = model
  const editNone = selectedBookmarks.length === 0
  const [color, setColor] = useState(
    selectedBookmarks[0].highlight ?? 'rgba(247, 129, 192, 0.35)',
  )

  return (
    <Dialog open onClose={onClose} title="Edit bookmarks">
      <DialogContent>
        <Typography variant="h6">Bulk highlight selector</Typography>
        <Alert severity="info">
          {editNone ? (
            <>
              <span>
                Use the checkboxes to select individual bookmarks to edit.
              </span>
            </>
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
        <Typography variant="h6">Highlight toggles</Typography>
        <Stack direction="row" alignItems="center">
          <Switch
            checked={model.highlightToggle}
            onChange={() => {
              model.setHighlightToggle(!model.highlightToggle)
            }}
          />
          <Typography variant="overline">
            Toggle bookmark highlights on all open views
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center">
          <Switch
            checked={model.labelToggle}
            onChange={() => {
              model.setLabelToggle(!model.labelToggle)
            }}
          />
          <Typography variant="overline">
            Toggle 'bookmark' icon on LGV tracks
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="secondary" onClick={() => onClose()}>
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

export default EditBookmarksDialog
