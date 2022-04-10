import React from 'react'
import { observer } from 'mobx-react'

import { assembleLocString } from '@jbrowse/core/util'

import {
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  makeStyles,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

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
  rowNumber,
  model,
  onClose,
}: {
  rowNumber: number | undefined
  model: GridBookmarkModel
  onClose: () => void
}) {
  const classes = useStyles()

  const { removeBookmark } = model

  return (
    <Dialog open={rowNumber !== undefined} onClose={onClose}>
      <DialogTitle>
        Delete bookmark
        <IconButton
          className={classes.closeDialog}
          aria-label="close-dialog"
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>
          Remove{' '}
          <code>
            {rowNumber !== undefined
              ? assembleLocString(model.bookmarkedRegions[rowNumber])
              : ''}
          </code>{' '}
          ?
        </Typography>
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
            if (rowNumber !== undefined) {
              removeBookmark(rowNumber)
              onClose()
            }
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(DeleteBookmarkDialog)
