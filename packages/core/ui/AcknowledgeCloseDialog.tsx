import React from 'react'
import { makeStyles } from 'tss-react/mui'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function AcknowledgeCloseDialog({
  closeOperation,
  handleClose,
}: {
  closeOperation: () => void
  handleClose: () => void
}) {
  // @ts-ignore
  const { classes } = useStyles()
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Are you sure you want to close this view?
        <IconButton
          className={classes.closeButton}
          onClick={handleClose}
          size="large"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Typography>
          Closing a view is irreversible and you will lose your work.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          onClick={() => {
            try {
              closeOperation()
              handleClose()
            } catch (e) {
              console.error(e)
            }
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
