import React, { useState } from 'react'
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
import { assembleLocString } from '@jbrowse/core/util'

// icons
import DeleteIcon from '@mui/icons-material/Delete'

// locals
import { GridBookmarkModel, IExtendedLabeledRegionModel } from '../model'

function DeleteBookmarks({ model }: { model: GridBookmarkModel }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { selectedBookmarks } = model
  const deleteAll = selectedBookmarks.length === 0

  return (
    <>
      <Button
        startIcon={<DeleteIcon />}
        aria-label="clear bookmarks"
        onClick={() => setDialogOpen(true)}
      >
        Delete
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Delete bookmarks"
      >
        <DialogContent>
          <Alert severity="warning">
            {deleteAll ? 'Delete all bookmarks?' : 'Delete selected bookmarks?'}
          </Alert>
          <List dense>
            {selectedBookmarks.map(
              (bookmark: IExtendedLabeledRegionModel, index: number) => (
                <ListItem key={`${index}-${assembleLocString(bookmark)}`}>
                  <ListItemText primary={assembleLocString(bookmark)} />
                </ListItem>
              ),
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setDialogOpen(false)
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
              setDialogOpen(false)
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default observer(DeleteBookmarks)
