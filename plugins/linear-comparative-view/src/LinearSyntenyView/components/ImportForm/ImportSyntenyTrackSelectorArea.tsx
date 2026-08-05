import { Suspense } from 'react'

import { getEnv, getSession } from '@jbrowse/core/util'
import {
  ImportFormOpenCustomTrack,
  ImportFormSyntenyChoiceRadioGroup,
  NoSyntenyTrackMessage,
  PreConfiguredSyntenyTrackSelect,
  allSessionTracks,
  getSyntenyTracks,
  useImportFormSyntenyChoice,
} from '@jbrowse/synteny-core'
import { CircularProgress } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

// #region option
export interface LinearSyntenyImportFormSyntenyOption {
  /** unique identifier for the radio option */
  value: string
  /** display text for the radio option */
  label: string
  ReactComponent: React.FC<{
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }>
}
// #endregion

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // #region registry
    'LinearSyntenyView-ImportFormSyntenyOptions': {
      args: LinearSyntenyImportFormSyntenyOption[]
      result: LinearSyntenyImportFormSyntenyOption[]
      props: {
        model: LinearSyntenyViewModel
        /** name of the top assembly */
        assembly1: string
        /** name of the bottom assembly */
        assembly2: string
        /** which synteny row of the import form the option is rendering for */
        selectedRow: number
      }
    }
    // #endregion
  }
}

const ImportSyntenyTrackSelectorArea = observer(
  function ImportSyntenyTrackSelectorArea({
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
    const session = getSession(model)
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
            model={model}
            rowIndex={selectedRow}
            /** #extensionPoint LinearSyntenyView-SyntenyFileFormats | sync | Add synteny file formats to the linear synteny import form */
            extensionPoint="LinearSyntenyView-SyntenyFileFormats"
            assembly1={assembly1}
            assembly2={assembly2}
          />
        ) : null}
        {choice === 'tracklist' ? (
          <PreConfiguredSyntenyTrackSelect
            model={model}
            tracks={getSyntenyTracks(allSessionTracks(session), [
              assembly1,
              assembly2,
            ])}
            rowIndex={selectedRow}
            emptyState={
              <NoSyntenyTrackMessage
                assembly1={assembly1}
                assembly2={assembly2}
                remedy='Choose "New track" above to add one, or launch anyway to stack these rows with no ribbons between them.'
              />
            }
          />
        ) : null}
        {selectedCustomOption ? (
          <Suspense fallback={<CircularProgress size={20} />}>
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
  },
)

export default ImportSyntenyTrackSelectorArea
