import React from 'react'
import { observer } from 'mobx-react'

import { assembleLocString } from '@jbrowse/core/util'

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
          Remove row number{' '}
          <code>
            {rowNumber !== undefined
              ? assembleLocString(model.bookmarkedRegions[rowNumber])
              : ''}
          </code>
        </Typography>
        <br />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
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
        </div>
      </div>
    </Dialog>
  )
}

export default observer(DeleteBookmarkDialog)
