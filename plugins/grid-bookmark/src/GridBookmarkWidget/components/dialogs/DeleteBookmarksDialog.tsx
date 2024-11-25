import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogContent, DialogActions, Alert } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import type { GridBookmarkModel } from '../../model'

const DeleteBookmarksDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { selectedBookmarks } = model
  const deleteAll = selectedBookmarks.length === 0

  return (
    <Dialog open onClose={onClose} title="Delete bookmarks">
      <DialogContent>
        <Alert severity="warning">
          {deleteAll ? (
            <>
              <span>All bookmarks will be deleted.</span>
              <br />
              <span>
                Use the checkboxes to select individual bookmarks to delete.
              </span>
            </>
          ) : (
            'Only selected bookmarks will be deleted.'
          )}
        </Alert>
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
            if (deleteAll) {
              model.clearAllBookmarks()
            }

            model.clearSelectedBookmarks()
            onClose()
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default DeleteBookmarksDialog
