import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import CloseIcon from '@mui/icons-material/Close'
import { CompactPicker, Color, RGBColor } from 'react-color'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

// this is needed because passing a entire color object into the react-color
// for alpha, can't pass in an rgba string for example
function serialize(color: Color) {
  if (color instanceof Object) {
    const { r, g, b } = color as RGBColor
    return `rgb(${r},${g},${b})`
  }
  return color
}

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    color: number
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [posneg, setPosNeg] = useState(false)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Select either an overall color, or the positive/negative colors. Note
        that density renderers only work properly with positive/negative colors
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <FormControlLabel
          checked={!posneg}
          onClick={() => setPosNeg(false)}
          control={<Radio />}
          label={'Overall color'}
        />
        <FormControlLabel
          checked={posneg}
          onClick={() => setPosNeg(true)}
          control={<Radio />}
          label={'Positive/negative color'}
        />

        {posneg ? (
          <>
            <Typography>Positive color</Typography>
            <CompactPicker
              onChange={event => {
                model.setPosColor(serialize(event.rgb))
                model.setColor(undefined)
              }}
            />
            <Typography>Negative color</Typography>

            <CompactPicker
              onChange={event => {
                model.setNegColor(serialize(event.rgb))
                model.setColor(undefined)
              }}
            />
          </>
        ) : (
          <>
            <Typography>Overall color</Typography>
            <CompactPicker
              onChange={event => model.setColor(serialize(event.rgb))}
            />
          </>
        )}
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
          onClick={() => handleClose()}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
