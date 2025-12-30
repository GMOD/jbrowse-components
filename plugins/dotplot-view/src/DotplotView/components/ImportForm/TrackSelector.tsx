import { useEffect, useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyOpenCustomTrack from './ImportSyntenyOpenCustomTrack.tsx'
import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelector.tsx'

import type { DotplotViewModel } from '../../model.ts'

export interface DotplotImportFormSyntenyOption {
  value: string
  label: string
  ReactComponent: React.FC<{
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }>
}

const TrackSelector = observer(function TrackSelector({
  assembly1,
  assembly2,
  model,
}: {
  model: DotplotViewModel
  assembly1: string
  assembly2: string
}) {
  const { pluginManager } = getEnv(model)
  const [choice, setChoice] = useState('tracklist')

  const customOptions = pluginManager.evaluateExtensionPoint(
    'DotplotView-ImportFormSyntenyOptions',
    [] as DotplotImportFormSyntenyOption[],
    { model, assembly1, assembly2 },
  ) as DotplotImportFormSyntenyOption[]

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

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
          {customOptions.map(opt => (
            <FormControlLabel
              key={opt.value}
              value={opt.value}
              control={<Radio />}
              label={opt.label}
            />
          ))}
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
      {selectedCustomOption ? (
        <selectedCustomOption.ReactComponent
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
        />
      ) : null}
    </>
  )
})

export default TrackSelector
