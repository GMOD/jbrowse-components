import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function ReturnToImportFormDialog({
  model,
  handleClose,
}: {
  model: { clearView: Function }
  handleClose: () => void
}) {
  const classes = useStyles()
  return (
    <Dialog maxWidth="xl" open onClose={handleClose}>
      <DialogTitle>
        Reference sequence
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => {
              handleClose()
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

      <DialogContent>
        <Typography>
          Are you sure you want to return to the import form? This will lose
          your current view
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            model.clearView()
            handleClose()
          }}
          variant="contained"
          color="primary"
          autoFocus
        >
          OK
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="secondary"
          variant="contained"
          autoFocus
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(ReturnToImportFormDialog)
