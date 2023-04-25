import React, { useState } from 'react'
import { Button, DialogContent, DialogActions, TextField } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  formElt: {
    margin: theme.spacing(3),
    width: 400,
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
    <Dialog
      maxWidth="xl"
      open
      onClose={() => handleClose()}
      title="Feature sequence settings"
    >
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
