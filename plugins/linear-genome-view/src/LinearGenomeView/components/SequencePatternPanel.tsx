import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import SearchPanelForm from './SearchPanelForm.tsx'
import StrandCheckboxes from './StrandCheckboxes.tsx'
import { addReferenceScanTrack } from './searchModes.ts'

import type { SequenceSearchModeProps } from './searchModes.ts'

const SequencePatternPanel = observer(function SequencePatternPanel({
  model,
  handleClose,
}: SequenceSearchModeProps) {
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
    <SearchPanelForm
      onSubmit={handleSubmit}
      handleClose={handleClose}
      submitDisabled={!canSubmit}
    >
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
        <LabeledCheckbox
          size="small"
          checked={caseInsensitive}
          onChange={val => {
            setCaseInsensitive(val)
          }}
          label="Case insensitive"
        />
      </StrandCheckboxes>
    </SearchPanelForm>
  )
})

export default SequencePatternPanel
