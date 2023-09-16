import React from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItemText,
  ListItem,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { assembleLocString, getSession } from '@jbrowse/core/util'

// locals
import { GridBookmarkModel } from '../model'

const DeleteBookmarksDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: (arg: boolean) => void
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
        <List dense>
          {selectedBookmarks.map((bookmark, index) => (
            <ListItem key={`${index}-${assembleLocString(bookmark)}`}>
              <ListItemText primary={assembleLocString(bookmark)} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => onClose(false)}
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
            onClose(false)
            getSession(model).notify(
              'Bookmarks have been successfully deleted',
              'success',
            )
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default DeleteBookmarksDialog
