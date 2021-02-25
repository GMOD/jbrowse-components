import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  TextField,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  Checkbox,
  FormControlLabel,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(4),
  },
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
    setFeatureHeight: Function
    setNoSpacing: Function
    featureHeightSetting: number
    noSpacing: boolean
  }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { display, handleClose } = props
  const { featureHeightSetting, noSpacing: noSpacingSetting } = display

  const [height, setHeight] = useState(`${featureHeightSetting}`)
  const [noSpacing, setNoSpacing] = useState(noSpacingSetting)

  const ok = height !== '' && !Number.isNaN(+height)

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Set feature height
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent style={{ overflowX: 'hidden' }}>
        <Typography>
          Adjust the feature height and whether there is any spacing between
          features. Setting feature height to 1 and removing spacing makes the
          display very compact
        </Typography>
        <div className={classes.root}>
          <Typography>Enter feature height: </Typography>
          <TextField
            value={height}
            onChange={event => {
              setHeight(event.target.value)
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={!!noSpacing}
                onChange={() => setNoSpacing(val => !val)}
              />
            }
            label="Remove spacing between features in y-direction?"
          />

          <Button
            variant="contained"
            color="primary"
            type="submit"
            style={{ marginLeft: 20 }}
            disabled={!ok}
            onClick={() => {
              display.setFeatureHeight(
                height !== '' && !Number.isNaN(+height) ? +height : undefined,
              )
              display.setNoSpacing(noSpacing)

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
