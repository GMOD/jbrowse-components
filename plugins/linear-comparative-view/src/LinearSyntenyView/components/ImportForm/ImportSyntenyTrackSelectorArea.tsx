import { useEffect, useState } from 'react'

import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'

import ImportCustomTrack from './ImportSyntenyOpenCustomTrack.tsx'
import ImportSyntenyTrackSelector from './ImportSyntenyPreConfigured.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'

export default function ImportSyntenyTrackSelectorArea({
  model,
  assembly1,
  assembly2,
  selectedRow,
}: {
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
  selectedRow: number
}) {
  const [choice, setChoice] = useState('tracklist')

  useEffect(() => {
    if (choice === 'none' || choice === 'custom') {
      model.setImportFormSyntenyTrack(selectedRow, { type: 'none' })
    }
  }, [choice, model, selectedRow])
  return (
    <div>
      <FormControl>
        <RadioGroup
          row
          value={choice}
          aria-labelledby="group-label"
          onChange={event => {
            setChoice(event.target.value)
          }}
        >
          <FormControlLabel value="none" control={<Radio />} label="None" />
          <FormControlLabel
            value="tracklist"
            control={<Radio />}
            label="Existing track"
          />
          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="New track"
          />
        </RadioGroup>
      </FormControl>
      {choice === 'custom' ? (
        <ImportCustomTrack
          model={model}
          selectedRow={selectedRow}
          assembly2={assembly2}
          assembly1={assembly1}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          model={model}
          selectedRow={selectedRow}
          assembly1={assembly1}
          assembly2={assembly2}
        />
      ) : null}
    </div>
  )
}
