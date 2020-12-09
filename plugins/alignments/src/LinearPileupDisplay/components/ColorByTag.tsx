/* eslint-disable no-nested-ternary */
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
// import Draggable from 'react-draggable'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

const useStyles = makeStyles(theme => ({
  root: {
    width: 300,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function ColorByTagDlg(props: {
  model: AnyConfigurationModel
  handleClose: () => void
}) {
  const classes = useStyles()
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const regex = /^[A-Za-z][A-Za-z0-9]$/
  const validTag = tag.match(regex)

  // once tag is chosen, fetch all possible values that can be returned from the tag
  // put into a map and associate it with a color from the swatch
  // potentially will have to be done on the main thread bc
  // would have to be done across blocks
  // in the PileupDisplayModel, example look at wiggle where it fetches across blocks and d/ls the domain of value for the scalebar
  // this would download data to get all values for the tag selected

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Color by tag
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent style={{ overflowX: 'hidden' }}>
        <Typography>Enter tag to color by</Typography>
        <div className={classes.root}>
          <form>
            <TextField
              id="standard-select-currency"
              value={tag}
              onChange={event => {
                setTag(event.target.value)
              }}
              placeholder="Enter Tag Name"
              inputProps={{ maxLength: 2 }}
              error={tag.length === 2 && !validTag}
              helperText={
                tag.length === 2 && !validTag ? 'Not a valid tag' : ''
              }
              autoComplete="off"
            />
            <Button
              variant="contained"
              color="primary"
              type="submit"
              style={{ marginLeft: 20 }}
              onClick={async () => {
                const display = await model.displays[0]
                ;(display.PileupDisplay || display).fetchValues({
                  type: 'tag',
                  tag,
                })
                handleClose()
              }}
              disabled={!validTag}
            >
              Submit
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
