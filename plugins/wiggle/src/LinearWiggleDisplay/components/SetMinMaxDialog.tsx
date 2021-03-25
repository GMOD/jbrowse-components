import React, { useState } from 'react'
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
  root: {},
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function SetMinMaxDlg(props: {
  display: {
    minScore: number
    maxScore: number
    setMinScore: Function
    setMaxScore: Function
  }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { display, handleClose } = props
  const { minScore, maxScore } = display

  const [min, setMin] = useState(
    `${minScore !== Number.MIN_VALUE ? minScore : ''}`,
  )
  const [max, setMax] = useState(
    `${maxScore !== Number.MAX_VALUE ? maxScore : ''}`,
  )

  const ok =
    min !== '' && max !== '' && !Number.isNaN(+min) && !Number.isNaN(+max)
      ? +max > +min
      : true

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Set min/max score for track
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
          <Typography>Enter min/max score: </Typography>
          {!ok ? (
            <Typography color="error">
              Max is greater than or equal to min
            </Typography>
          ) : null}

          <TextField
            value={min}
            onChange={event => {
              setMin(event.target.value)
            }}
            placeholder="Enter min score"
          />
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
            disabled={!ok}
            onClick={() => {
              display.setMinScore(
                min !== '' && !Number.isNaN(+min) ? +min : undefined,
              )
              display.setMaxScore(
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
}
