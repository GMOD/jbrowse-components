import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogContent,
  DialogActions,
  Typography,
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
import { GridBookmarkModel } from '../model'

function DeleteBookmarks({ model }: { model: GridBookmarkModel }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <>
      <Button
        startIcon={<DeleteIcon />}
        aria-label="clear bookmarks"
        onClick={() => setDialogOpen(true)}
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
            {model.selectedBookmarks.map((bookmark: any) => (
              <>
                <ListItem>
                  {/* @ts-ignore */}
                  <ListItemText primary={assembleLocString(bookmark)} />
                </ListItem>
              </>
            ))}
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
              // model.clearAllBookmarks()
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
