import React, { useState } from 'react'
import { observer } from 'mobx-react'

import {
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  Typography,
  makeStyles,
} from '@material-ui/core'
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

function DeleteBookmarkDialog({
  locString,
  model,
  onClose,
}: {
  locString: string | undefined
  model: GridBookmarkModel
  onClose: () => void
}) {
  const classes = useStyles()

  const { removeBookmark } = model

  return (
    <Dialog open={!!locString} onClose={onClose}>
      <DialogTitle>
        <IconButton
          className={classes.closeDialog}
          aria-label="close-dialog"
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <div className={classes.dialogContainer}>
        <Typography>
          Remove <code>{locString}</code>?
        </Typography>
        <br />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (locString) {
                removeBookmark(locString)
                onClose()
              }
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default observer(DeleteBookmarkDialog)
