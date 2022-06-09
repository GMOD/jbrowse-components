import React from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
  Theme,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()((theme: Theme) => ({
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
  const { classes } = useStyles()
  return (
    <Dialog maxWidth="xl" open onClose={handleClose}>
      <DialogTitle>
        Reference sequence
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => handleClose()}
            size="large"
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
          onClick={() => handleClose()}
          color="secondary"
          variant="contained"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(ReturnToImportFormDialog)
