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
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface DotplotImportFormSyntenyOption {
  value: string
  label: string
  ReactComponent: React.FC<{
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }>
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'DotplotView-ImportFormSyntenyOptions': {
      args: DotplotImportFormSyntenyOption[]
      result: DotplotImportFormSyntenyOption[]
      props: { model: DotplotViewModel; assembly1: string; assembly2: string }
    }
  }
}

const TrackSelector = observer(function TrackSelector({
  model,
  assemblyX,
  assemblyY,
  syntenyTracks,
  choice,
  setChoice,
  preConfiguredTrackId,
  setPreConfiguredTrackId,
}: {
  model: DotplotViewModel
  assemblyX: string
  assemblyY: string
  syntenyTracks: AnyConfigurationModel[]
  choice: string
  setChoice: (arg: string) => void
  preConfiguredTrackId: string
  setPreConfiguredTrackId: (arg: string) => void
}) {
  const { pluginManager } = getEnv(model)

  // extension-point and core components use the public assembly1/assembly2
  // (y-axis/x-axis) prop names
  const assembly1 = assemblyY
  const assembly2 = assemblyX
  const customOptions = pluginManager.evaluateExtensionPoint(
    'DotplotView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2 },
  )

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

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
            const val = event.target.value
            setChoice(val)
            if (val === 'none' || val === 'custom') {
              model.setImportFormSyntenyTrack(0, { type: 'none' })
            }
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
          key={`${assembly1}-${assembly2}`}
          model={model}
          assembly2={assembly2}
          assembly1={assembly1}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          model={model}
          assemblyX={assemblyX}
          assemblyY={assemblyY}
          syntenyTracks={syntenyTracks}
          value={preConfiguredTrackId}
          setValue={setPreConfiguredTrackId}
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
