import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getEnv } from '@jbrowse/core/util'
import { ImportFormSyntenyTrackPanel } from '@jbrowse/synteny-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { ImportFormSyntenyChoices } from '@jbrowse/synteny-core'

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

/**
 * The synteny view's binding of the shared import-form track panel: it declares
 * this view's options extension point (whose props carry `selectedRow`, which is
 * why the point stays here) and hands the panel this form's wording.
 */
const ImportSyntenyTrackSelectorArea = observer(
  function ImportSyntenyTrackSelectorArea({
    model,
    assembly1,
    assembly2,
    selectedRow,
    labelledBy,
    choices,
  }: {
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
    choices: ImportFormSyntenyChoices
    /** id of the form's per-pair heading, which names this radio group */
    labelledBy: string
  }) {
    const { pluginManager } = getEnv(model)

    const customOptions = pluginManager.evaluateExtensionPoint(
      /** #extensionPoint LinearSyntenyView-ImportFormSyntenyOptions | sync | Add options to the linear synteny view import form */
      'LinearSyntenyView-ImportFormSyntenyOptions',
      [],
      { model, assembly1, assembly2, selectedRow },
    )

    return (
      <ImportFormSyntenyTrackPanel
        model={model}
        rowIndex={selectedRow}
        assembly1={assembly1}
        assembly2={assembly2}
        choices={choices}
        /** #extensionPoint LinearSyntenyView-SyntenyFileFormats | sync | Add synteny file formats to the linear synteny import form */
        fileFormatsExtensionPoint="LinearSyntenyView-SyntenyFileFormats"
        labelledBy={labelledBy}
        customOptions={customOptions}
        renderCustomOption={value => {
          const option = customOptions.find(opt => opt.value === value)
          return option ? (
            <option.ReactComponent
              model={model}
              assembly1={assembly1}
              assembly2={assembly2}
              selectedRow={selectedRow}
            />
          ) : null
        }}
        emptyRemedy='Choose "New track" above to add one, or launch anyway to stack these rows with no ribbons between them.'
      >
        {/* the same note the dotplot form carries: the import form picks one
        track per band, and everything else is a track-selector click away once
        the view is open */}
        <Typography variant="body2" color="text.secondary">
          More synteny tracks can be turned on per band from the track selector{' '}
          <TrackSelectorIcon /> once the view is open.
        </Typography>
      </ImportFormSyntenyTrackPanel>
    )
  },
)

export default ImportSyntenyTrackSelectorArea
