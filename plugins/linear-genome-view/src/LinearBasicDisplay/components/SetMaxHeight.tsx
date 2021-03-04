import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
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

export default observer(
  (props: {
    display: {
      maxHeight?: number
      setMaxHeight: Function
    }
    handleClose: () => void
  }) => {
    const { display, handleClose } = props
    const classes = useStyles()
    const { maxHeight = '' } = display
    const [max, setMax] = useState(`${maxHeight}`)

    return (
      <Dialog
        open
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Filter options
          <IconButton
            aria-label="close"
            className={classes.closeButton}
            onClick={handleClose}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <div className={classes.root}>
            <Typography>Set max height for the track</Typography>
            <TextField
              value={max}
              onChange={event => {
                setMax(event.target.value)
              }}
              placeholder="Enter max score"
            />
            <Button
              variant="contained"
              color="primary"
              type="submit"
              style={{ marginLeft: 20 }}
              onClick={() => {
                display.setMaxHeight(
                  max !== '' && !Number.isNaN(+max) ? +max : undefined,
                )
                handleClose()
              }}
            >
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  },
)
