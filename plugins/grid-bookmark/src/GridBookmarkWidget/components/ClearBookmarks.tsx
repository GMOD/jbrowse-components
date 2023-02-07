import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

// icons
import ClearAllIcon from '@mui/icons-material/ClearAll'

// locals
import { GridBookmarkModel } from '../model'

function ClearBookmarks({ model }: { model: GridBookmarkModel }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <>
      <Button
        startIcon={<ClearAllIcon />}
        aria-label="clear bookmarks"
        onClick={() => setDialogOpen(true)}
      >
        Clear
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Clear bookmarks"
      >
        <DialogContent>
          <Typography>
            Clear all bookmarks? Note this will clear bookmarks for all
            assemblies
          </Typography>
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

export default observer(ClearBookmarks)
