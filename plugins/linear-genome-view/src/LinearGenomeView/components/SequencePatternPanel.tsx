import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import StrandCheckboxes from './StrandCheckboxes.tsx'
import { addReferenceScanTrack } from './searchModes.ts'

import type { SequenceSearchModeProps } from './searchModes.ts'

const useStyles = makeStyles()({
  dialogContent: {
    width: '34em',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
})

const SequencePatternPanel = observer(function SequencePatternPanel({
  model,
  handleClose,
}: SequenceSearchModeProps) {
  const { classes } = useStyles()
  const [value, setValue] = useState('')
  const [caseInsensitive, setCaseInsensitive] = useState(true)
  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)

  let patternError: unknown
  try {
    new RegExp(value)
  } catch (e) {
    patternError = e
  }

  const canSubmit = !!value && !patternError && (searchForward || searchReverse)

  function handleSubmit() {
    addReferenceScanTrack(model, {
      trackId: `sequence_search_${Date.now()}`,
      name: `Sequence search ${value}`,
      adapter: {
        type: 'SequenceSearchAdapter',
        search: value,
        searchForward,
        searchReverse,
        caseInsensitive,
      },
    })
    handleClose()
  }

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        <TextField
          size="small"
          value={value}
          onChange={e => {
            setValue(e.target.value)
          }}
          label="Sequence pattern"
          placeholder="e.g. AACT(C|T)"
          error={!!patternError}
          helperText={
            patternError ? `${patternError}` : 'Plain sequence or a regex'
          }
        />
        <StrandCheckboxes
          searchForward={searchForward}
          searchReverse={searchReverse}
          setSearchForward={setSearchForward}
          setSearchReverse={setSearchReverse}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={caseInsensitive}
                onChange={event => {
                  setCaseInsensitive(event.target.checked)
                }}
              />
            }
            label="Case insensitive"
          />
        </StrandCheckboxes>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleSubmit()
          }}
          disabled={!canSubmit}
          variant="contained"
          color="primary"
        >
          Submit
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="secondary"
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default SequencePatternPanel
