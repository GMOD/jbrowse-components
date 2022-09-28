import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
  formElt: {
    margin: theme.spacing(3),
    width: 400,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogContent: {
    width: '80em',
  },
}))

export default function SequenceFeatureSettingsDialog({
  handleClose,
  intronBp: intronBpArg,
  upDownBp: upDownBpArg,
}: {
  handleClose: (arg?: { intronBp: number; upDownBp: number }) => void
  intronBp: number
  upDownBp: number
}) {
  const { classes } = useStyles()
  const [intronBp, setIntronBp] = useState(`${intronBpArg}`)
  const [upDownBp, setUpDownBp] = useState(`${upDownBpArg}`)
  const intronBpValid = !Number.isNaN(+intronBp)
  const upDownBpValid = !Number.isNaN(+upDownBp)
  return (
    <Dialog maxWidth="xl" open onClose={() => handleClose()}>
      <DialogTitle>
        Feature sequence settings
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => handleClose()}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

      <DialogContent className={classes.dialogContent}>
        <TextField
          label="Number of intronic bases around splice site to display"
          className={classes.formElt}
          value={intronBp}
          helperText={!intronBpValid ? 'Not a number' : ''}
          error={!intronBpValid}
          onChange={event => setIntronBp(event.target.value)}
        />
        <TextField
          label="Number of bases up/down stream of feature to display"
          className={classes.formElt}
          value={upDownBp}
          helperText={!upDownBpValid ? 'Not a number' : ''}
          error={!upDownBpValid}
          onChange={event => setUpDownBp(event.target.value)}
        />
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() =>
            handleClose({
              upDownBp: +upDownBp,
              intronBp: +intronBp,
            })
          }
          disabled={!intronBpValid || !upDownBpValid}
          color="primary"
          variant="contained"
        >
          Submit
        </Button>
        <Button
          onClick={() => handleClose()}
          color="secondary"
          autoFocus
          variant="contained"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
