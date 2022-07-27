import React, { useState } from 'react'
import { observer } from 'mobx-react'
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
import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    color?: string
    posColor?: string
    negColor?: string
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
            <ColorPicker
              color={model.posColor || 'black'}
              onChange={event => {
                model.setPosColor(event)
                model.setColor(undefined)
              }}
            />
            <Typography>Negative color</Typography>

            <ColorPicker
              color={model.negColor || 'black'}
              onChange={event => {
                model.setNegColor(event)
                model.setColor(undefined)
              }}
            />
          </>
        ) : (
          <>
            <Typography>Overall color</Typography>
            <ColorPicker
              color={model.color || 'black'}
              onChange={event => model.setColor(event)}
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

export default observer(SetColorDialog)
