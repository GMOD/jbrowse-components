import { Suspense } from 'react'

import { getEnv } from '@jbrowse/core/util'
import {
  ImportFormOpenCustomTrack,
  ImportFormSyntenyChoiceRadioGroup,
  useImportFormSyntenyChoice,
} from '@jbrowse/synteny-core'

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
  const { choice, setChoice } = useImportFormSyntenyChoice(model, selectedRow)

  const customOptions = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint LinearSyntenyView-ImportFormSyntenyOptions | sync | Add options to the linear synteny view import form */
    'LinearSyntenyView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2, selectedRow },
  )

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

  return (
    <div>
      <ImportFormSyntenyChoiceRadioGroup
        choice={choice}
        onChange={setChoice}
        customOptions={customOptions}
      />
      {choice === 'custom' ? (
        <ImportFormOpenCustomTrack
          key={`${assembly1}-${assembly2}`}
          model={model}
          rowIndex={selectedRow}
          extensionPoint="LinearSyntenyView-SyntenyFileFormats"
          assembly1={assembly1}
          assembly2={assembly2}
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
        <Suspense fallback={null}>
          <selectedCustomOption.ReactComponent
            model={model}
            assembly1={assembly1}
            assembly2={assembly2}
            selectedRow={selectedRow}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
