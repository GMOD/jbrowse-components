import React, { useState } from 'react'
import { observer } from 'mobx-react'

import {
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  Typography,
  makeStyles,
} from '@material-ui/core'
import ClearAllIcon from '@material-ui/icons/ClearAll'
import CloseIcon from '@material-ui/icons/Close'

import { GridBookmarkModel } from '../model'

const useStyles = makeStyles(() => ({
  closeDialog: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dialogContainer: {
    margin: 15,
  },
}))

function ClearBookmarks({ model }: { model: GridBookmarkModel }) {
  const classes = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { clearAllBookmarks } = model

  return (
    <>
      <Button
        startIcon={<ClearAllIcon />}
        aria-label="clear bookmarks"
        onClick={() => setDialogOpen(true)}
      >
        Clear
      </Button>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          <IconButton
            className={classes.closeDialog}
            aria-label="close-dialog"
            onClick={() => setDialogOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <div className={classes.dialogContainer}>
          <>
            <Typography>
              Clear all bookmarks? Note this will clear bookmarks for all
              assemblies
            </Typography>
            <br />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  clearAllBookmarks()
                  setDialogOpen(false)
                }}
              >
                Confirm
              </Button>
            </div>
          </>
        </div>
      </Dialog>
    </>
  )
}

export default observer(ClearBookmarks)
