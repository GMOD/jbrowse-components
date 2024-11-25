import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogContent,
  DialogActions,
  FormControlLabel,
  FormControl,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { SequenceFeatureDetailsModel } from '../model'
import type { TextFieldProps } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  formElt: {
    margin: theme.spacing(3),
    width: 400,
  },
  dialogContent: {
    width: '80em',
  },
  root: {
    padding: 4,
  },
}))

function TextField2(props: TextFieldProps) {
  return (
    <div>
      <TextField {...props} />
    </div>
  )
}

function FormControl2({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <FormControl>{children}</FormControl>
    </div>
  )
}

const SequenceFeatureSettingsDialog = observer(function ({
  handleClose,
  model,
}: {
  handleClose: () => void
  model: SequenceFeatureDetailsModel
}) {
  const { classes } = useStyles()
  const { upperCaseCDS } = model
  const [intronBp, setIntronBp] = useState(`${model.intronBp}`)
  const [upDownBp, setUpDownBp] = useState(`${model.upDownBp}`)
  const intronBpValid = !Number.isNaN(+intronBp)
  const upDownBpValid = !Number.isNaN(+upDownBp)
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => {
        handleClose()
      }}
      title="Feature sequence settings"
    >
      <DialogContent className={classes.dialogContent}>
        <TextField2
          label="Number of intronic bases around splice site to display"
          className={classes.formElt}
          value={intronBp}
          helperText={!intronBpValid ? 'Not a number' : ''}
          error={!intronBpValid}
          onChange={event => {
            setIntronBp(event.target.value)
          }}
        />
        <TextField2
          label="Number of bases up/down stream of feature to display"
          className={classes.formElt}
          value={upDownBp}
          helperText={!upDownBpValid ? 'Not a number' : ''}
          error={!upDownBpValid}
          onChange={event => {
            setUpDownBp(event.target.value)
          }}
        />
        <FormControl2>
          <FormLabel>Sequence capitalization</FormLabel>
          <RadioGroup
            value={upperCaseCDS ? 'cds' : 'unchanged'}
            onChange={e => {
              model.setUpperCaseCDS(e.target.value === 'cds')
            }}
          >
            <FormControlLabel
              value="cds"
              control={<Radio className={classes.root} size="small" />}
              label="Capitalize CDS and lower case everything else"
            />
            <FormControlLabel
              value="unchanged"
              control={<Radio className={classes.root} size="small" />}
              label="Capitalization from reference genome sequence"
            />
          </RadioGroup>
        </FormControl2>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() => {
            model.setIntronBp(+intronBp)
            model.setUpDownBp(+upDownBp)
            handleClose()
          }}
          disabled={!intronBpValid || !upDownBpValid}
          color="primary"
          variant="contained"
        >
          Submit
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="secondary"
          autoFocus
          variant="contained"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SequenceFeatureSettingsDialog
