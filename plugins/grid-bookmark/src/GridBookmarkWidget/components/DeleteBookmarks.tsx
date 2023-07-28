import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

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
              console.log('TODO: implement clear selected bookmarks')
              //model.clearSelectedBookmarks()
              model.clearAllBookmarks()
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
