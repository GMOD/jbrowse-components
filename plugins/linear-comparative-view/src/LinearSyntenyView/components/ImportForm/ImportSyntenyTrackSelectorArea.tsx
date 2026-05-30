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
    selectedRow: number
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
        selectedRow: number
      }
    }
  }
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
  // reflect this row's existing selection (custom/extension uploads can't be
  // told apart from "none" in the model, so they start on the "none" radio)
  const [choice, setChoice] = useState<string>(() => {
    const selection = model.importFormSyntenyTrackSelections[selectedRow]
    return selection?.type === 'none'
      ? 'none'
      : selection?.type === 'userOpened'
        ? 'custom'
        : 'tracklist'
  })

  const customOptions = pluginManager.evaluateExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2, selectedRow },
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
              model.setImportFormSyntenyTrack(selectedRow, { type: 'none' })
            } else if (val === 'tracklist') {
              model.setImportFormSyntenyTrack(selectedRow, {
                type: 'preConfigured',
                value: '',
              })
            } else {
              // extension option — clear stale selection so the extension
              // component owns the model from here
              model.setImportFormSyntenyTrack(selectedRow, { type: 'none' })
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
          selectedRow={selectedRow}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          key={`${assembly1}-${assembly2}`}
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
          selectedRow={selectedRow}
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
