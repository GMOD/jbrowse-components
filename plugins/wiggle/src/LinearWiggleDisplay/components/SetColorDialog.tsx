import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Button,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { CompactPicker, Color, RGBColor } from 'react-color'

const useStyles = makeStyles(theme => ({
  root: {},
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

// this is needed because passing a entire color object into the react-color
// for alpha, can't pass in an rgba string for example
function serializeColor(color: Color) {
  if (color instanceof Object) {
    const { r, g, b, a } = color as RGBColor
    return `rgb(${r},${g},${b},${a})`
  }
  return color
}

export default function SetColorDialog(props: {
  model: {
    color: number
    setColor: Function
  }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { model, handleClose } = props

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Select a color
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent style={{ overflowX: 'hidden' }}>
        <div className={classes.root}>
          <CompactPicker
            onChange={event => {
              model.setColor(serializeColor(event.rgb))
            }}
          />
          <br />
          <div style={{ margin: 20 }}>
            <Button
              onClick={() => {
                model.setColor(undefined)
              }}
              color="secondary"
              variant="contained"
            >
              Restore default from config
            </Button>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              onClick={() => {
                handleClose()
              }}
            >
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
