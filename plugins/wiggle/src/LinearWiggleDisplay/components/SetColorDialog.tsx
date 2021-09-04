import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  IconButton,
  Typography,
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
    const { r, g, b } = color as RGBColor
    return `rgb(${r},${g},${b})`
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
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Select a color
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>Positive color</Typography>
        <CompactPicker
          onChange={event => {
            model.setPosColor(serializeColor(event.rgb))
          }}
        />
        <Typography>Negative color</Typography>
        <CompactPicker
          onChange={event => {
            model.setNegColor(serializeColor(event.rgb))
          }}
        />
        <Typography>Overall color</Typography>
        <CompactPicker
          onChange={event => {
            model.setColor(serializeColor(event.rgb))
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            model.setPosColor(undefined)
            model.setNegColor(undefined)
            model.setColor(undefined)
          }}
          color="secondary"
          variant="contained"
        >
          Restore default
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
      </DialogActions>
    </Dialog>
  )
}
