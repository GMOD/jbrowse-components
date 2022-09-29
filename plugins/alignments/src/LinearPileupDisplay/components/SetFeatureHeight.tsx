import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function SetFeatureHeightDlg(props: {
  model: {
    setFeatureHeight: Function
    setNoSpacing: Function
    featureHeightSetting: number
    noSpacing?: boolean
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
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
          display very compact.
        </Typography>
        <TextField
          value={height}
          helperText="Feature height"
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
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            autoFocus
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

export default observer(SetFeatureHeightDlg)
