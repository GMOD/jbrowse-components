import { useEffect, useState } from 'react'

import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyOpenCustomTrack from './ImportSyntenyOpenCustomTrack'
import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelector'

import type { DotplotViewModel } from '../../model'

const TrackSelector = observer(function ({
  assembly1,
  assembly2,
  model,
}: {
  model: DotplotViewModel
  assembly1: string
  assembly2: string
}) {
  const [choice, setChoice] = useState('tracklist')

  useEffect(() => {
    if (choice === 'none') {
      model.setImportFormSyntenyTrack(0, { type: 'none' })
    }
  }, [model, choice])
  return (
    <>
      <FormControl>
        <FormLabel id="group-label">
          (Optional) Select or add a synteny track
        </FormLabel>
        <RadioGroup
          row
          value={choice}
          onChange={event => {
            setChoice(event.target.value)
          }}
          aria-labelledby="group-label"
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
        <ImportSyntenyOpenCustomTrack
          model={model}
          assembly2={assembly2}
          assembly1={assembly1}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
        />
      ) : null}
    </>
  )
})

export default TrackSelector
