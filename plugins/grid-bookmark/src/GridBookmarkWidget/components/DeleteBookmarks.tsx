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
import { assembleLocString, useLocalStorage } from '@jbrowse/core/util'

// icons
import DeleteIcon from '@mui/icons-material/Delete'

// locals
import { GridBookmarkModel, IExtendedLabeledRegionModel } from '../model'

function DeleteBookmarks({ model }: { model: GridBookmarkModel }) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        startIcon={<DeleteIcon />}
        aria-label="clear bookmarks"
        onClick={() => setDialogOpen(true)}
        disabled={model.selectedBookmarks.length === 0}
      >
        Delete selected bookmarks
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Delete selected bookmarks"
      >
        <DialogContent>
          <Alert severity="warning">Delete selected bookmarks?</Alert>
          <List dense>
            {model.selectedBookmarks.map(
              (bookmark: IExtendedLabeledRegionModel) => (
                <ListItem key={assembleLocString(bookmark)}>
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
