import { Suspense } from 'react'

import { getEnv } from '@jbrowse/core/util'
import {
  ImportFormOpenCustomTrack,
  ImportFormSyntenyChoiceRadioGroup,
  useImportFormSyntenyChoice,
} from '@jbrowse/synteny-core'
import { CircularProgress } from '@mui/material'
import { observer } from 'mobx-react'

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
}: {
  model: DotplotViewModel
  assemblyX: string
  assemblyY: string
  syntenyTracks: AnyConfigurationModel[]
}) {
  const { pluginManager } = getEnv(model)

  // extension-point and core components use the public assembly1/assembly2
  // (y-axis/x-axis) prop names
  const assembly1 = assemblyY
  const assembly2 = assemblyX

  const { choice, setChoice } = useImportFormSyntenyChoice(model, 0)

  const customOptions = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint DotplotView-ImportFormSyntenyOptions | sync | Add options to the dotplot view import form */
    'DotplotView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2 },
  )

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

  return (
    <>
      <ImportFormSyntenyChoiceRadioGroup
        choice={choice}
        onChange={setChoice}
        customOptions={customOptions}
        label="(Optional) Select or add a synteny track"
      />
      {choice === 'custom' ? (
        <ImportFormOpenCustomTrack
          key={`${assembly1}-${assembly2}`}
          model={model}
          rowIndex={0}
          /** #extensionPoint DotplotView-SyntenyFileFormats | sync | Add synteny file formats to the dotplot import form */
          extensionPoint="DotplotView-SyntenyFileFormats"
          assembly1={assembly1}
          assembly2={assembly2}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          model={model}
          assemblyX={assemblyX}
          assemblyY={assemblyY}
          syntenyTracks={syntenyTracks}
        />
      ) : null}
      {selectedCustomOption ? (
        <Suspense fallback={<CircularProgress size={20} />}>
          <selectedCustomOption.ReactComponent
            model={model}
            assembly1={assembly1}
            assembly2={assembly2}
          />
        </Suspense>
      ) : null}
    </>
  )
})

export default TrackSelector
