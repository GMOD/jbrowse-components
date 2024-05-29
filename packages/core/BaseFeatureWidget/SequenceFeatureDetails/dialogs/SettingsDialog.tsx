import React, { useState } from 'react'
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
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import { SequenceFeatureDetailsModel } from '../model'

const useStyles = makeStyles()(theme => ({
  formElt: {
    margin: theme.spacing(3),
    width: 400,
  },
  dialogContent: {
    width: '80em',
  },
}))

const SequenceFeatureSettingsDialog = observer(function ({
  handleClose,
  model,
}: {
  handleClose: () => void
  model: SequenceFeatureDetailsModel
}) {
  const { classes } = useStyles()
  const [intronBp, setIntronBp] = useState(`${model.intronBp}`)
  const [upDownBp, setUpDownBp] = useState(`${model.upDownBp}`)
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
        <div>
          <TextField
            label="Number of intronic bases around splice site to display"
            className={classes.formElt}
            value={intronBp}
            helperText={!intronBpValid ? 'Not a number' : ''}
            error={!intronBpValid}
            onChange={event => setIntronBp(event.target.value)}
          />
        </div>
        <div>
          <TextField
            label="Number of bases up/down stream of feature to display"
            className={classes.formElt}
            value={upDownBp}
            helperText={!upDownBpValid ? 'Not a number' : ''}
            error={!upDownBpValid}
            onChange={event => setUpDownBp(event.target.value)}
          />
        </div>
        <div>
          <FormControl>
            <FormLabel>Sequence capitalization</FormLabel>
            <RadioGroup
              value={model.upperCaseCDS ? 'cds' : 'unchanged'}
              onChange={e => model.setUpperCaseCDS(e.target.value === 'cds')}
            >
              <FormControlLabel
                value="cds"
                control={<Radio />}
                label="Capitalize CDS and lower case everything else"
              />
              <FormControlLabel
                value="unchanged"
                control={<Radio />}
                label="Capitalization from reference genome sequence"
              />
            </RadioGroup>
          </FormControl>
        </div>
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
})

export default SequenceFeatureSettingsDialog
