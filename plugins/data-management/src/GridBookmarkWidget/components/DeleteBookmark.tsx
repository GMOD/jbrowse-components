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
import DeleteIcon from '@material-ui/icons/Delete'
import CloseIcon from '@material-ui/icons/Close'

import { getSession } from '@jbrowse/core/util'

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

function DeleteBookmark({
  locString,
  model,
}: {
  locString: string
  model: GridBookmarkModel
}) {
  const classes = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)

  // @ts-ignore
  const { removeBookmark } = getSession(model)

  return (
    <>
      <IconButton
        data-testid="deleteBookmark"
        aria-label="delete"
        onClick={() => setDialogOpen(true)}
      >
        <DeleteIcon />
      </IconButton>
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
              Remove <code>{locString}</code>?
            </Typography>
            <br />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  removeBookmark(locString)
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

export default observer(DeleteBookmark)
