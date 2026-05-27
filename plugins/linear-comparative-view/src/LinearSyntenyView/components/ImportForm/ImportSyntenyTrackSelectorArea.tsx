import { useState } from 'react'

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
  }>
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LinearSyntenyView-ImportFormSyntenyOptions': {
      args: LinearSyntenyImportFormSyntenyOption[]
      result: LinearSyntenyImportFormSyntenyOption[]
      props: {
        model: LinearSyntenyViewModel
        assembly1: string
        assembly2: string
      }
    }
  }
}

export default function ImportSyntenyTrackSelectorArea({
  model,
  assembly1,
  assembly2,
}: {
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
}) {
  const { pluginManager } = getEnv(model)
  const [choice, setChoice] = useState('tracklist')

  const customOptions = pluginManager.evaluateExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2 },
  )

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

  return (
    <div>
      <FormControl>
        <RadioGroup
          row
          value={choice}
          onChange={event => {
            const val = event.target.value
            setChoice(val)
            if (val === 'none' || val === 'custom') {
              model.setImportFormSyntenyTrack(0, { type: 'none' })
            }
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
          key={`${assembly1}-${assembly2}`}
          model={model}
          assembly2={assembly2}
          assembly1={assembly1}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          key={`${assembly1}-${assembly2}`}
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
    </div>
  )
}
