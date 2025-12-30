import { useEffect, useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'

import ImportCustomTrack from './ImportSyntenyOpenCustomTrack.tsx'
import ImportSyntenyTrackSelector from './ImportSyntenyPreConfigured.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'

export interface LinearSyntenyImportFormSyntenyOption {
  value: string
  label: string
  ReactComponent: React.FC<{
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }>
}

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
  const { pluginManager } = getEnv(model)
  const [choice, setChoice] = useState('tracklist')

  const customOptions = pluginManager.evaluateExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    [] as LinearSyntenyImportFormSyntenyOption[],
    { model, assembly1, assembly2, selectedRow },
  ) as LinearSyntenyImportFormSyntenyOption[]

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

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
      {selectedCustomOption ? (
        <selectedCustomOption.ReactComponent
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
          selectedRow={selectedRow}
        />
      ) : null}
    </div>
  )
}
