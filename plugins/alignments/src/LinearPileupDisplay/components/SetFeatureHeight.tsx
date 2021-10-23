import React, { useState } from 'react'
import { observer } from 'mobx-react'
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
  makeStyles,
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

function SetFeatureHeightDlg(props: {
  model: {
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
  const { model, handleClose } = props
  const { featureHeightSetting, noSpacing: noSpacingSetting } = model

  const [height, setHeight] = useState(`${featureHeightSetting}`)
  const [noSpacing, setNoSpacing] = useState(noSpacingSetting)

  const ok = height !== '' && !Number.isNaN(+height)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Set feature height
        <IconButton className={classes.closeButton} onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
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
              model.setFeatureHeight(
                height !== '' && !Number.isNaN(+height) ? +height : undefined,
              )
              model.setNoSpacing(noSpacing)

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

export default observer(SetFeatureHeightDlg)
