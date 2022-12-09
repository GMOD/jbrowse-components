import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
  root: {
    width: 500,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  field: {
    margin: theme.spacing(2),
  },
}))

function SetMaxHeightDlg(props: {
  model: {
    maxHeight?: number
    setMaxHeight: Function
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const { maxHeight = '' } = model
  const [max, setMax] = useState(`${maxHeight}`)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Filter options
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.root}>
        <Typography>
          Set max height for the track. For example, you can increase this if
          the layout says &quot;Max height reached&quot;
        </Typography>
        <TextField
          value={max}
          onChange={event => {
            setMax(event.target.value)
          }}
          placeholder="Enter max height for layout"
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            autoFocus
            onClick={() => {
              model.setMaxHeight(
                max !== '' && !Number.isNaN(+max) ? +max : undefined,
              )
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

export default observer(SetMaxHeightDlg)
