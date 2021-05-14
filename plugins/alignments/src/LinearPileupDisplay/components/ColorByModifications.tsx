import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  FormControlLabel,
  Checkbox,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

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

function ColorByTagDlg(props: {
  model: { setColorScheme: Function }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { model, handleClose, fadeLikelihoodSetting } = props
  const [fadeLikelihood, setFadeLikelihood] = useState(fadeLikelihoodSetting)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Color by modifications
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
          <FormControlLabel
            control={
              <Checkbox
                checked={!!fadeLikelihood}
                onChange={() => setFadeLikelihood(val => !val)}
              />
            }
            label="Fade low likelihood calls?"
          />

          <div>Current modification-type-to-color mapping</div>
          <Button
            variant="contained"
            color="primary"
            style={{ marginLeft: 20 }}
            onClick={() => {
              model.setColorScheme({
                type: 'modifications',
                fadeLikelihood,
              })
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

export default observer(ColorByTagDlg)
