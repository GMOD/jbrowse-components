import { useState } from 'react'

import SequenceAdapterInputs from '@jbrowse/core/ui/SequenceAdapterInputs'
import {
  applyPrimaryFile,
  applyTwoBitFile,
  formHasSequence,
} from '@jbrowse/core/util/assemblyConfigUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Button, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import AdvancedOptions from './AdvancedOptions.tsx'

import type { FormState } from '@jbrowse/core/util/assemblyConfigUtils'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  advancedButton: {
    marginTop: theme.spacing(1),
  },
}))

const GuidedForm = observer(function GuidedForm({
  form,
  setForm,
  loading,
  onStageAnother,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  loading: string
  onStageAnother: () => void
}) {
  const { classes } = useStyles()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const setPrimaryFile = (loc: FileLocation) => {
    setForm(f => applyPrimaryFile(f, loc))
  }
  const setTwoBitFile = (loc: FileLocation) => {
    setForm(f => applyTwoBitFile(f, loc))
  }

  return (
    <>
      <TextField
        label="Assembly name"
        helperText="The assembly name e.g. hg38"
        variant="outlined"
        fullWidth
        value={form.assemblyName}
        onChange={event => {
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
        }}
      />

      <SequenceAdapterInputs
        form={form}
        setForm={setForm}
        setPrimaryFile={setPrimaryFile}
        setTwoBitFile={setTwoBitFile}
      />

      <Button
        variant="text"
        size="small"
        className={classes.advancedButton}
        startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => {
          setShowAdvanced(a => !a)
        }}
      >
        Advanced options
      </Button>
      {showAdvanced ? (
        <>
          <AdvancedOptions form={form} setForm={setForm} />
          <Button
            className={classes.advancedButton}
            variant="outlined"
            size="small"
            disabled={!!loading || !form.assemblyName || !formHasSequence(form)}
            onClick={() => {
              onStageAnother()
            }}
          >
            Stage this genome and add another
          </Button>
          <Typography variant="caption" component="div">
            Open multiple genomes at once. Staged genomes appear at the top and
            load together when you click Open.
          </Typography>
        </>
      ) : null}
    </>
  )
})

export default GuidedForm
