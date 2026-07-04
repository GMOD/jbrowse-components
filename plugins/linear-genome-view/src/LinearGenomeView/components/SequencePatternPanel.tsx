import { useState } from 'react'

import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { addReferenceScanTrack, useSearchModeStyles } from './searchModes.ts'

import type { SequenceSearchModeProps } from './searchModes.ts'

const SequencePatternPanel = observer(function SequencePatternPanel({
  model,
  handleClose,
}: SequenceSearchModeProps) {
  const { classes } = useSearchModeStyles()
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

  const bothStrandsOff = !searchForward && !searchReverse
  const canSubmit = !!value && !patternError && !bothStrandsOff

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
        <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={searchForward}
                onChange={event => {
                  setSearchForward(event.target.checked)
                }}
              />
            }
            label="Forward strand"
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={searchReverse}
                onChange={event => {
                  setSearchReverse(event.target.checked)
                }}
              />
            }
            label="Reverse strand"
          />
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
        </FormGroup>
        {bothStrandsOff ? (
          <Typography color="error" variant="body2">
            Select at least one strand
          </Typography>
        ) : null}
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
