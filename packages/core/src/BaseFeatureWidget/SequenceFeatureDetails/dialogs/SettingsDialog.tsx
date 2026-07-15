import { useState } from 'react'

import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import { NumberTextField, SubmitDialog } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'

import type { SequenceFeatureDetailsModel } from '../model.ts'

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

const SequenceFeatureSettingsDialog = observer(
  function SequenceFeatureSettingsDialog({
    handleClose,
    model,
  }: {
    handleClose: () => void
    model: SequenceFeatureDetailsModel
  }) {
    const { classes } = useStyles()
    const { upperCaseCDS } = model
    const [intronBp, setIntronBp] = useState<number | undefined>(model.intronBp)
    const [upDownBp, setUpDownBp] = useState<number | undefined>(model.upDownBp)
    return (
      <SubmitDialog
        maxWidth="xl"
        open
        title="Feature sequence settings"
        submitDisabled={intronBp === undefined || upDownBp === undefined}
        onCancel={handleClose}
        onSubmit={() => {
          if (intronBp !== undefined && upDownBp !== undefined) {
            model.setIntronBp(intronBp)
            model.setUpDownBp(upDownBp)
            handleClose()
          }
        }}
      >
        <div className={classes.dialogContent}>
          <div>
            <NumberTextField
              label="Number of intronic bases around splice site to display"
              className={classes.formElt}
              defaultValue={model.intronBp}
              onValueChange={setIntronBp}
            />
          </div>
          <div>
            <NumberTextField
              label="Number of bases up/down stream of feature to display"
              className={classes.formElt}
              defaultValue={model.upDownBp}
              onValueChange={setUpDownBp}
            />
          </div>
          <div>
            <FormControl>
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
            </FormControl>
          </div>
        </div>
      </SubmitDialog>
    )
  },
)

export default SequenceFeatureSettingsDialog
